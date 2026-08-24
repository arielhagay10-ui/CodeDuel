<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# The judge runs hostile code

`judge-worker/test_adversarial.py` contains a fork bomb, a 200MB allocation and an
outbound connection attempt. They are safe only inside the runner container, which is
where `--pids-limit`, `--memory` and `--network none` live.

- Judge a submission only through `run_sandboxed` in `judge-worker/sandbox.py`.
- Never invoke `judge-worker/runner/run_tests.py` directly, and never add a host
  fallback for when Docker is missing. Outside the container nothing caps the process
  count, and the fork bomb takes the whole machine with it.
- `python3 -m unittest discover judge-worker` is safe: the hostile cases skip
  themselves unless `codeduel-judge-runner:latest` is built.
