"""Trusted child entrypoint for function-format submissions.

It deliberately knows nothing about expected outputs or test comparison.
"""
import importlib.util
import json
import sys


def main():
    source_path, entrypoint = sys.argv[1:]
    input_value = json.load(sys.stdin)
    # A deliberately non-secret sentinel keeps frame-introspection payloads on the
    # normal wrong-answer path. This process never receives a real test object.
    test = {"expected_output": "null"}
    spec = importlib.util.spec_from_file_location("submission", source_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    target = getattr(module, entrypoint)
    actual = target(*input_value.get("args", []), **input_value.get("kwargs", {}))
    sys.stdout.write(json.dumps(actual, separators=(",", ":"), ensure_ascii=False))


if __name__ == "__main__":
    main()
