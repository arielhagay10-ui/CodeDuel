"""Sandbox-escape tests.

Every payload here is genuinely hostile -- a fork bomb, a 200MB allocation, an
outbound connection -- and every verdict they assert comes from a container flag in
`sandbox.py`, not from anything `run_tests.py` enforces about itself. So they run
through `run_sandboxed` and nowhere else.

There is no host fallback. If the runner image is not built these tests skip, because
the alternative is running a fork bomb on whoever typed `unittest discover`.

    docker compose -f docker-compose.judge.yml build judge-runner
"""
import json
import subprocess
import unittest

from sandbox import run_sandboxed, sandbox_available

SANDBOX_AVAILABLE, SANDBOX_REASON = sandbox_available()


def judge(source, *, expected="3"):
    payload = {
        "format": "function", "entrypoint": "solve", "source_code": source,
        "tests": [{"input_data": '{"args": [1, 2]}', "expected_output": expected}],
    }
    try:
        completed = run_sandboxed(payload, timeout=30)
    except subprocess.TimeoutExpired:
        raise AssertionError("runner container did not terminate; the sandbox is not holding") from None
    if completed.returncode != 0:
        raise AssertionError(f"runner container exited {completed.returncode}: {completed.stderr.strip()[:1000]!r}")
    try:
        return json.loads(completed.stdout)
    except json.JSONDecodeError:
        raise AssertionError(f"runner produced non-JSON: {completed.stdout.strip()[:500]!r}") from None


@unittest.skipUnless(SANDBOX_AVAILABLE, f"sandbox unavailable: {SANDBOX_REASON}")
class AdversarialRunnerTests(unittest.TestCase):
    def test_parent_frame_cannot_read_expected_output(self):
        result = judge('import sys, json\ndef solve(*a): return json.loads(sys._getframe(1).f_locals["test"]["expected_output"])')
        self.assertEqual(result["verdict"], "wrong_answer")

    def test_cannot_patch_parent_normalizer(self):
        result = judge('import __main__\n__main__.normalize = lambda value: "3"\ndef solve(*a): return None')
        self.assertEqual(result["verdict"], "wrong_answer")

    def test_import_exit_is_terminal(self):
        result = judge('import sys\nsys.exit(0)')
        self.assertEqual(result["verdict"], "runtime_error")

    def test_busy_loop_times_out(self):
        result = judge('def solve(*a):\n while True: pass')
        self.assertEqual(result["verdict"], "time_limit_exceeded")

    def test_sleep_times_out_on_wall_clock(self):
        result = judge('import time\ndef solve(*a):\n time.sleep(600)')
        self.assertEqual(result["verdict"], "time_limit_exceeded")

    def test_cannot_write_outside_tmp(self):
        result = judge('def solve(*a):\n open("/etc/passwd", "w").write("owned")\n return 3')
        self.assertEqual(result["verdict"], "runtime_error")

    def test_network_access_is_terminal(self):
        result = judge('import socket\ndef solve(*a):\n socket.create_connection(("1.1.1.1", 443), timeout=1)\n return 3')
        self.assertEqual(result["verdict"], "runtime_error")

    def test_fork_bomb_is_terminal(self):
        result = judge('import os\ndef solve(*a):\n while True: os.fork()')
        self.assertEqual(result["verdict"], "runtime_error")

    def test_memory_exhaustion_is_terminal(self):
        result = judge('def solve(*a):\n return "x" * (200 * 1024 * 1024)')
        self.assertEqual(result["verdict"], "runtime_error")

    def test_stdout_flood_is_terminal(self):
        result = judge('def solve(*a):\n print("x" * (100 * 1024 * 1024))\n return 3')
        self.assertEqual(result["verdict"], "runtime_error")


class SandboxWiringTests(unittest.TestCase):
    """These run everywhere, image or not: they are what keeps the suite off the host."""

    def test_sandbox_command_is_a_container(self):
        from sandbox import sandbox_command

        command = sandbox_command()
        self.assertEqual(command[:2], ["docker", "run"])
        for flag in ("--network", "none", "--pids-limit", "--memory", "--read-only", "--cap-drop"):
            self.assertIn(flag, command)

    def test_module_never_reaches_for_the_runner_script(self):
        import sandbox

        self.assertNotIn("run_tests.py", (sandbox.sandbox_command() or []))
        self.assertNotIn("run_tests", " ".join(sandbox.sandbox_command()))


if __name__ == "__main__":
    unittest.main()
