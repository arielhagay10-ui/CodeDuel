"""Run from /worker in the private worker container; always uses the sandbox."""
import json
import statistics
import time

from sandbox import run_sandboxed


def measure(tests):
    durations = []
    for _ in range(20):
        start = time.perf_counter()
        result = run_sandboxed({
            "format": "function", "entrypoint": "solve",
            "source_code": "def solve(value):\n    return value\n", "tests": tests,
        }, timeout=10)
        assert result.returncode == 0, result.stderr
        assert json.loads(result.stdout)["verdict"] == "accepted", result.stdout
        durations.append((time.perf_counter() - start) * 1000)
    return {"samples": 20, "mean_ms": round(statistics.mean(durations), 1),
            "median_ms": round(statistics.median(durations), 1),
            "p95_ms": round(sorted(durations)[18], 1)}


print(json.dumps({
    "empty_runner_startup_and_teardown": measure([]),
    "three_trivial_tests_total": measure([
        {"input_data": json.dumps({"args": [n]}), "expected_output": str(n), "ordinal": n}
        for n in range(1, 4)
    ]),
}), flush=True)
