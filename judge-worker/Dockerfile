FROM docker:27-cli AS docker_cli

FROM python:3.12-slim

WORKDIR /worker
RUN useradd --system --uid 10001 --create-home judge
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=docker_cli /usr/local/bin/docker /usr/local/bin/docker
COPY worker.py rating.py sandbox.py verify_seed.py ./
# The runner sources deliberately do not ship here. This image holds the Docker socket,
# so a copy of run_tests.py inside it is an invitation to judge a submission without a
# container. The runner image is built separately and is the only place they belong.
USER judge
CMD ["python", "-u", "worker.py"]
