"""The one place that starts a container for untrusted code.

Every guarantee the judge relies on -- process ceiling, memory ceiling, no network,
read-only root -- is a flag in this file, not something `run_tests.py` can enforce
about itself. Running the runner outside this wrapper runs a submission's fork bombs
and allocations directly on the host, so nothing in this repo may invoke
`runner/run_tests.py` without going through `run_sandboxed`.
"""
import json
import os
import shutil
import subprocess

RUNNER_IMAGE = os.getenv("JUDGE_RUNNER_IMAGE", "codeduel-judge-runner:latest")

SANDBOX_FLAGS = [
    "--rm", "-i", "--network", "none", "--read-only", "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges", "--pids-limit", "32", "--memory", "128m", "--cpus", "0.5",
    "--user", "10001:10001", "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
]


def sandbox_command(image=None):
    return ["docker", "run", *SANDBOX_FLAGS, image or RUNNER_IMAGE]


def sandbox_available(image=None):
    """Report whether a real sandbox can start, so callers skip rather than fall back.

    There is no host fallback on purpose: the payloads this runs are hostile.
    """
    if shutil.which("docker") is None:
        return False, "docker is not installed"
    image = image or RUNNER_IMAGE
    probe = subprocess.run(
        ["docker", "image", "inspect", image],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
    )
    if probe.returncode != 0:
        return False, f"runner image {image!r} is not built"
    return True, ""


def run_sandboxed(payload, timeout, image=None):
    """Judge one payload inside the container. Raises subprocess.TimeoutExpired on overrun."""
    return subprocess.run(
        sandbox_command(image), input=json.dumps(payload), text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, check=False,
    )
