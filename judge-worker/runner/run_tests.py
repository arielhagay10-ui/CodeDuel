import contextlib
import importlib.util
import io
import json
import os
import resource
import signal
import subprocess
import sys
import traceback


def limit_resources():
    resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
    resource.setrlimit(resource.RLIMIT_AS, (96 * 1024 * 1024, 96 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))


def normalize(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def function_test(source_path, entrypoint, test):
    spec = importlib.util.spec_from_file_location("submission", source_path)
    module = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        spec.loader.exec_module(module)
        target = getattr(module, entrypoint)
        input_value = json.loads(test["input_data"])
        args = input_value.get("args", [])
        kwargs = input_value.get("kwargs", {})
        actual = target(*args, **kwargs)
    return normalize(actual) == normalize(json.loads(test["expected_output"]))


def stdio_test(source_path, test):
    result = subprocess.run(
        [sys.executable, source_path], input=test["input_data"], text=True,
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=2, check=False,
    )
    return result.returncode == 0 and result.stdout.strip() == test["expected_output"].strip()


def main():
    limit_resources()
    payload = json.load(sys.stdin)
    source_path = "/tmp/submission.py"
    with open(source_path, "w", encoding="utf-8") as source_file:
        source_file.write(payload["source_code"])
    passed = 0
    runtime_error = False
    try:
        for test in payload["tests"]:
            try:
                ok = function_test(source_path, payload["entrypoint"], test) if payload["format"] == "function" else stdio_test(source_path, test)
                passed += int(ok)
            except Exception:
                runtime_error = True
    except Exception:
        runtime_error = True
    verdict = "accepted" if passed == len(payload["tests"]) else ("runtime_error" if runtime_error and passed == 0 else "wrong_answer")
    print(json.dumps({"verdict": verdict, "tests_passed": passed, "tests_total": len(payload["tests"])}))


if __name__ == "__main__":
    main()
