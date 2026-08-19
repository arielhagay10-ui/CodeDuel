FROM docker:27-cli AS docker_cli

FROM python:3.12-slim

WORKDIR /worker
RUN useradd --system --uid 10001 --create-home judge
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=docker_cli /usr/local/bin/docker /usr/local/bin/docker
COPY worker.py rating.py .
USER judge
CMD ["python", "-u", "worker.py"]
