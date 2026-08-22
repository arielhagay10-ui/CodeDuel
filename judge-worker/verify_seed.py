"""Verify published reference solutions against all of their tests."""
import json
import os
import subprocess
import sys

import psycopg
from psycopg.rows import dict_row


def main():
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
            result = subprocess.run(
                [sys.executable, "runner/run_tests.py"],
                input=json.dumps(payload),
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
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
