FROM python:3.12-slim

RUN useradd --system --uid 10001 runner
WORKDIR /work
COPY run_tests.py invoke_function.py /runner/
USER runner
ENTRYPOINT ["python", "/runner/run_tests.py"]
