# Private Python judge worker

Build and run it only on private infrastructure with access to PostgreSQL and Docker Engine:

```sh
docker compose -f docker-compose.judge.yml build
docker compose -f docker-compose.judge.yml up judge-worker
```

For a self-contained local PostgreSQL database and worker, run:

```sh
docker compose -f docker-compose.local.yml up --build -d
```

Then copy `.env.local.example` to `.env.local` for the Next.js app. The local database is initialized by the ordered files in `db/migrations/` on its first startup.

The worker claims durable PostgreSQL jobs and launches one short-lived runner container per submission. It streams the candidate source only into the runner's temporary filesystem and applies no-network, non-root, read-only filesystem, capability, CPU, memory, PID, and wall-clock restrictions. The worker is not an HTTP service.

`/var/run/docker.sock` in the Compose file is only for local MVP orchestration. Treat Docker-socket access as privileged: production should use a separately access-controlled runner host/daemon and never expose this worker or its socket to the internet.

The worker container runs as root solely to access that local Docker socket. This does **not** apply to submitted programs: every submission executes as UID 10001 in its separate runner container. Do not reuse this Docker-socket pattern for a public production service.
