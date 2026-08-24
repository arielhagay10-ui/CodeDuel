import json
import os
import resource
import select
import subprocess
import sys
import tempfile
import time


WALL_TIME_SECONDS = 2
MAX_OUTPUT_BYTES = 1024 * 1024


def limit_resources():
    resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
    resource.setrlimit(resource.RLIMIT_AS, (96 * 1024 * 1024, 96 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))


def normalize(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def read_limited(process, timeout):
    """Read child stdout without allowing a submission to fill runner memory."""
    output = bytearray()
    deadline = time.monotonic() + timeout
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            process.kill()
            process.wait()
            return None, "time_limit_exceeded"
        ready, _, _ = select.select([process.stdout], [], [], remaining)
        if ready:
            chunk = os.read(process.stdout.fileno(), min(65536, MAX_OUTPUT_BYTES + 1 - len(output)))
            if chunk:
                output.extend(chunk)
                if len(output) > MAX_OUTPUT_BYTES:
                    process.kill()
                    process.wait()
                    return None, "runtime_error"
                continue
        if process.poll() is not None:
            while True:
                chunk = os.read(process.stdout.fileno(), min(65536, MAX_OUTPUT_BYTES + 1 - len(output)))
                if not chunk:
                    break
                output.extend(chunk)
                if len(output) > MAX_OUTPUT_BYTES:
                    return None, "runtime_error"
            return bytes(output), None


def run_function(source_path, entrypoint, input_data):
    # This child receives inputs only. Expected outputs and comparison stay outside
    # the submitted program's Python interpreter.
    invoker_path = "/runner/invoke_function.py"
    if not os.path.exists(invoker_path):
        invoker_path = os.path.join(os.path.dirname(__file__), "invoke_function.py")
    process = subprocess.Popen(
        [sys.executable, invoker_path, source_path, entrypoint],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=False,
    )
    try:
        process.stdin.write(input_data.encode("utf-8"))
        process.stdin.close()
    except (BrokenPipeError, OSError):
        pass
    output, error = read_limited(process, WALL_TIME_SECONDS)
    if error:
        return None, error
    if process.returncode != 0:
        return None, "runtime_error"
    try:
        return json.loads(output), None
    except (TypeError, json.JSONDecodeError, UnicodeDecodeError):
        return None, "runtime_error"


def function_test(source_path, entrypoint, test):
    actual, error = run_function(source_path, entrypoint, test["input_data"])
    if error:
        return False, error
    return normalize(actual) == normalize(json.loads(test["expected_output"])), None


def stdio_test(source_path, test):
    process = subprocess.Popen(
        [sys.executable, source_path], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=False,
    )
    try:
        process.stdin.write(test["input_data"].encode("utf-8"))
        process.stdin.close()
    except (BrokenPipeError, OSError):
        pass
    output, error = read_limited(process, WALL_TIME_SECONDS)
    if error:
        return False, error
    if process.returncode != 0:
        return False, "runtime_error"
    return output.decode("utf-8", errors="replace").strip() == test["expected_output"].strip(), None


def main():
    limit_resources()
    payload = json.load(sys.stdin)
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", dir="/tmp", delete=False, encoding="utf-8") as source_file:
        source_file.write(payload["source_code"])
        source_path = source_file.name
    passed = 0
    terminal_error = None
    try:
        for test in payload["tests"]:
            if payload["format"] == "function":
                ok, error = function_test(source_path, payload["entrypoint"], test)
            else:
                ok, error = stdio_test(source_path, test)
            passed += int(ok)
            terminal_error = terminal_error or error
    finally:
        os.unlink(source_path)
    verdict = "accepted" if passed == len(payload["tests"]) else (terminal_error or "wrong_answer")
    print(json.dumps({"verdict": verdict, "tests_passed": passed, "tests_total": len(payload["tests"])}))


if __name__ == "__main__":
    main()
