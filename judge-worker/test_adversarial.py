import json
import os
import subprocess
import sys
import unittest


RUNNER = os.path.join(os.path.dirname(__file__), "runner", "run_tests.py")


def judge(source, *, expected="3"):
    payload = {
        "format": "function", "entrypoint": "solve", "source_code": source,
        "tests": [{"input_data": '{"args": [1, 2]}', "expected_output": expected}],
    }
    completed = subprocess.run(
        [sys.executable, RUNNER], input=json.dumps(payload), text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5, check=False,
    )
    return json.loads(completed.stdout)


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


if __name__ == "__main__":
    unittest.main()
