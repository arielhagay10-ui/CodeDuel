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
MAX_PROCESSES = 24


def limit_resources():
    resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
    resource.setrlimit(resource.RLIMIT_AS, (96 * 1024 * 1024, 96 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
    # Defence in depth behind the container's --pids-limit. RLIMIT_AS caps one process,
    # so without a process ceiling `while True: os.fork()` multiplies that cap instead of
    # hitting it. Inherited by every child, and CPU accounting resets on fork, so this is
    # the only limit here that a fork bomb actually runs into.
    resource.setrlimit(resource.RLIMIT_NPROC, (MAX_PROCESSES, MAX_PROCESSES))


def normalize(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def read_limited(process, timeout):
    """Read child stdout without letting a submission fill runner memory.

    Returns (output, None) once the child closes stdout and exits, or (None, verdict)
    if it overruns the wall clock or floods stdout. The caller owns cleanup.
    """
    output = bytearray()
    deadline = time.monotonic() + timeout
    stdout = process.stdout
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return None, "time_limit_exceeded"
        ready, _, _ = select.select([stdout], [], [], remaining)
        if not ready:
            continue
        chunk = os.read(stdout.fileno(), min(65536, MAX_OUTPUT_BYTES + 1 - len(output)))
        if not chunk:
            # EOF. A closed pipe stays permanently readable, so polling it again here
            # would spin the loop at full tilt until the deadline.
            break
        output.extend(chunk)
        if len(output) > MAX_OUTPUT_BYTES:
            return None, "runtime_error"
    try:
        # stdout can close well before the process exits; it still owes us an exit code.
        process.wait(timeout=max(0.0, deadline - time.monotonic()))
    except subprocess.TimeoutExpired:
        return None, "time_limit_exceeded"
    return bytes(output), None


def release(process):
    """Reap the child and close its pipes.

    Popen does not close these for us, and a leaked pair per test walks straight into
    the RLIMIT_NOFILE ceiling on any problem with more than a handful of tests.
    """
    if process.poll() is None:
        process.kill()
        process.wait()
    for stream in (process.stdin, process.stdout):
        if stream is not None and not stream.closed:
            stream.close()


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
    finally:
        release(process)


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
    finally:
        release(process)


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
