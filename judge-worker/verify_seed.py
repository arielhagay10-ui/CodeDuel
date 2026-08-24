"""Verify published reference solutions against all of their tests."""
import json
import os
import subprocess
import sys

import psycopg
from psycopg.rows import dict_row

from sandbox import run_sandboxed, sandbox_available


def main():
    # Reference solutions are ours, but they are still arbitrary code and they still
    # get the container: a runaway reference solution should fail a check, not a laptop.
    available, reason = sandbox_available()
    if not available:
        raise SystemExit(f"cannot verify seeds: {reason}")
    with psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row) as conn:
        problems = conn.execute(
            "SELECT id, slug, format, entrypoint, reference_solution FROM problems WHERE published_at IS NOT NULL AND retired_at IS NULL ORDER BY slug"
        ).fetchall()
        failures = []
        for problem in problems:
            tests = conn.execute(
                "SELECT input_data, expected_output, ordinal FROM problem_tests WHERE problem_id = %s ORDER BY ordinal",
                (problem["id"],),
            ).fetchall()
            payload = {
                "format": problem["format"],
                "entrypoint": problem["entrypoint"],
                "source_code": problem["reference_solution"],
                "tests": tests,
            }
            try:
                result = run_sandboxed(payload, timeout=60)
            except subprocess.TimeoutExpired:
                failures.append(f"{problem['slug']}: reference solution did not finish in 60s")
                continue
            try:
                outcome = json.loads(result.stdout)
            except json.JSONDecodeError:
                failures.append(f"{problem['slug']}: runner failed: {result.stderr.strip()}")
                continue
            if outcome["verdict"] != "accepted" or outcome["tests_passed"] != outcome["tests_total"]:
                failures.append(f"{problem['slug']}: {outcome}")
        if failures:
            print("\n".join(failures), file=sys.stderr)
            raise SystemExit(1)
        print(f"Verified {len(problems)} published problems.")


if __name__ == "__main__":
    main()
