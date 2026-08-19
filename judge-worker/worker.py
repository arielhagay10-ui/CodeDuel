"""Private worker. Never expose this service or its Docker socket publicly."""
import json
import os
import subprocess
import time
import uuid

import psycopg
from psycopg.rows import dict_row

from rating import Rating, update_rating, visible_rank

DATABASE_URL = os.environ["DATABASE_URL"]
RUNNER_IMAGE = os.getenv("JUDGE_RUNNER_IMAGE", "codewars-judge-runner:latest")
WORKER_ID = os.getenv("HOSTNAME", f"judge-{uuid.uuid4()}")
POLL_SECONDS = float(os.getenv("JUDGE_POLL_SECONDS", "1"))


def claim_job(conn):
    with conn.transaction():
        job = conn.execute("""
          WITH candidate AS (
            SELECT id FROM judge_jobs WHERE status = 'queued' AND available_at <= now()
            ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
          )
          UPDATE judge_jobs SET status = 'running', locked_at = now(), locked_by = %s, attempts = attempts + 1
          WHERE id = (SELECT id FROM candidate)
          RETURNING id, submission_id
        """, (WORKER_ID,)).fetchone()
    return job


def load_submission(conn, submission_id):
    return conn.execute("""
      SELECT s.id, s.source_code, p.format, p.entrypoint, p.time_limit_ms,
        jsonb_agg(jsonb_build_object('input_data', t.input_data, 'expected_output', t.expected_output, 'ordinal', t.ordinal) ORDER BY t.ordinal) AS tests
      FROM submissions s JOIN problems p ON p.id = s.problem_id JOIN problem_tests t ON t.problem_id = p.id
      WHERE s.id = %s GROUP BY s.id, p.id
    """, (submission_id,)).fetchone()


def execute(submission):
    payload = {"format": submission["format"], "entrypoint": submission["entrypoint"], "tests": submission["tests"], "source_code": submission["source_code"]}
    command = [
        "docker", "run", "--rm", "-i", "--network", "none", "--read-only", "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges", "--pids-limit", "32", "--memory", "128m", "--cpus", "0.5",
        "--user", "10001:10001", "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m", RUNNER_IMAGE,
    ]
    try:
        result = subprocess.run(command, input=json.dumps(payload), text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=max(3, submission["time_limit_ms"] / 1000 + 2), check=False)
    except subprocess.TimeoutExpired:
        return {"verdict": "time_limit_exceeded", "tests_passed": 0, "tests_total": len(submission["tests"])}
    if result.returncode != 0:
        return {"verdict": "internal_error", "tests_passed": 0, "tests_total": len(submission["tests"])}
    return json.loads(result.stdout)


def persist_result(conn, job_id, submission_id, result):
    with conn.transaction():
        conn.execute("""
          UPDATE submissions SET verdict = %s, tests_passed = %s, tests_total = %s, hidden_result = %s::jsonb, judged_at = now()
          WHERE id = %s
        """, (result["verdict"], result["tests_passed"], result["tests_total"], json.dumps(result), submission_id))
        conn.execute("UPDATE judge_jobs SET status = 'completed', completed_at = now() WHERE id = %s", (job_id,))
        resolve_round_if_ready(conn, submission_id)
        resolve_placement_if_ready(conn, submission_id, result)


def resolve_placement_if_ready(conn, submission_id, result):
    attempt = conn.execute("""
      SELECT p.id, p.user_id, p.difficulty, p.status, r.mmr, r.rating_deviation, r.volatility, r.placement_matches_completed
      FROM submissions s JOIN placement_attempts p ON p.id = s.placement_attempt_id
      JOIN user_difficulty_ratings r ON r.user_id = p.user_id AND r.difficulty = p.difficulty
      WHERE s.id = %s FOR UPDATE OF p, r
    """, (submission_id,)).fetchone()
    if not attempt or attempt["status"] != "active":
        return
    before = Rating(float(attempt["mmr"]), float(attempt["rating_deviation"]), float(attempt["volatility"]))
    # Placements are solo calibration in the current product UI. A fixed benchmark converts hidden-test performance into a Glicko-2 signal.
    score = result["tests_passed"] / max(1, result["tests_total"])
    outcome = 1.0 if score == 1.0 else 0.5 if score >= 0.5 else 0.0
    after = update_rating(before, Rating(1500.0, 350.0, 0.06), outcome)
    placements = min(5, int(attempt["placement_matches_completed"]) + 1)
    tier, division = visible_rank(after.mmr)
    conn.execute("""
      UPDATE user_difficulty_ratings SET mmr = %s, rating_deviation = %s, volatility = %s, placement_matches_completed = %s,
        visible_tier = %s, visible_division = %s, updated_at = now() WHERE user_id = %s AND difficulty = %s
    """, (after.mmr, after.deviation, after.volatility, placements, tier if placements == 5 else None, division if placements == 5 else None, attempt["user_id"], attempt["difficulty"]))
    conn.execute("UPDATE placement_attempts SET status = 'completed', tests_passed = %s, tests_total = %s, completed_at = now() WHERE id = %s", (result["tests_passed"], result["tests_total"], attempt["id"]))


def resolve_round_if_ready(conn, submission_id):
    """Results become visible only after both players have submitted and both jobs finish."""
    round_row = conn.execute("SELECT match_round_id FROM submissions WHERE id = %s FOR UPDATE", (submission_id,)).fetchone()
    if not round_row or not round_row["match_round_id"]:
        return
    round_id = round_row["match_round_id"]
    round_data = conn.execute("""
      SELECT r.status, r.match_id, m.player_one_id, m.player_two_id
      FROM match_rounds r JOIN matches m ON m.id = r.match_id WHERE r.id = %s FOR UPDATE OF r
    """, (round_id,)).fetchone()
    if not round_data or round_data["status"] != "active":
        return
    submissions = conn.execute("""
      SELECT user_id, verdict, tests_passed FROM submissions
      WHERE match_round_id = %s AND user_id IN (%s, %s)
    """, (round_id, round_data["player_one_id"], round_data["player_two_id"])).fetchall()
    if len(submissions) != 2 or any(row["verdict"] in ("queued", "running") for row in submissions):
        return
    scores = {row["user_id"]: row["tests_passed"] for row in submissions}
    first = scores[round_data["player_one_id"]]
    second = scores[round_data["player_two_id"]]
    winner = round_data["player_one_id"] if first > second else round_data["player_two_id"] if second > first else None
    conn.execute("""
      UPDATE match_rounds SET status = %s, winner_id = %s, player_one_tests_passed = %s,
        player_two_tests_passed = %s, completed_at = now() WHERE id = %s
    """, ("completed" if winner else "draw", winner, first, second, round_id))
    update_match_after_round(conn, round_data["match_id"] if "match_id" in round_data else None)


def update_match_after_round(conn, match_id):
    if not match_id:
        return
    match = conn.execute("SELECT status, difficulty, player_one_id, player_two_id FROM matches WHERE id = %s FOR UPDATE", (match_id,)).fetchone()
    if not match or match["status"] == "completed":
        return
    rounds = conn.execute("SELECT round_number, winner_id, status FROM match_rounds WHERE match_id = %s ORDER BY round_number", (match_id,)).fetchall()
    wins_one = sum(row["winner_id"] == match["player_one_id"] for row in rounds)
    wins_two = sum(row["winner_id"] == match["player_two_id"] for row in rounds)
    completed = [row for row in rounds if row["status"] in ("completed", "draw")]
    final = match["difficulty"] == "advanced" or wins_one == 2 or wins_two == 2 or len(completed) == len(rounds)
    if final:
        winner = match["player_one_id"] if wins_one > wins_two else match["player_two_id"] if wins_two > wins_one else None
        conn.execute("UPDATE matches SET status = 'completed', winner_id = %s, completed_at = now() WHERE id = %s", (winner, match_id))
        apply_match_ratings(conn, match_id, winner)
    else:
        conn.execute("UPDATE matches SET status = 'between_rounds', ready_window_ends_at = now() + interval '60 seconds' WHERE id = %s", (match_id,))


def apply_match_ratings(conn, match_id, winner_id):
    """One immutable rating event per player and completed rated match."""
    existing = conn.execute("SELECT 1 FROM rating_events WHERE match_id = %s LIMIT 1", (match_id,)).fetchone()
    if existing:
        return
    match = conn.execute("SELECT difficulty, player_one_id, player_two_id FROM matches WHERE id = %s FOR UPDATE", (match_id,)).fetchone()
    ratings = conn.execute("""
      SELECT user_id, mmr, rating_deviation, volatility, placement_matches_completed
      FROM user_difficulty_ratings WHERE difficulty = %s AND user_id IN (%s, %s) FOR UPDATE
    """, (match["difficulty"], match["player_one_id"], match["player_two_id"])).fetchall()
    by_user = {row["user_id"]: row for row in ratings}
    first, second = by_user[match["player_one_id"]], by_user[match["player_two_id"]]
    first_rating = Rating(float(first["mmr"]), float(first["rating_deviation"]), float(first["volatility"]))
    second_rating = Rating(float(second["mmr"]), float(second["rating_deviation"]), float(second["volatility"]))
    first_outcome = 0.5 if winner_id is None else 1.0 if winner_id == match["player_one_id"] else 0.0
    second_outcome = 1.0 - first_outcome
    updates = [(first, second, first_outcome), (second, first, second_outcome)]
    for player, opponent, outcome in updates:
        before = Rating(float(player["mmr"]), float(player["rating_deviation"]), float(player["volatility"]))
        opponent_before = Rating(float(opponent["mmr"]), float(opponent["rating_deviation"]), float(opponent["volatility"]))
        after = update_rating(before, opponent_before, outcome)
        placements = min(5, int(player["placement_matches_completed"]) + 1)
        tier, division = visible_rank(after.mmr)
        conn.execute("""
          UPDATE user_difficulty_ratings SET mmr = %s, rating_deviation = %s, volatility = %s,
            placement_matches_completed = %s, visible_tier = %s, visible_division = %s, updated_at = now()
          WHERE user_id = %s AND difficulty = %s
        """, (after.mmr, after.deviation, after.volatility, placements, tier if placements == 5 else None, division if placements == 5 else None, player["user_id"], match["difficulty"]))
        conn.execute("""
          INSERT INTO rating_events (id, match_id, user_id, opponent_id, difficulty, outcome, mmr_before, mmr_after,
            deviation_before, deviation_after, volatility_before, volatility_after, placement_match_number)
          VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (str(uuid.uuid4()), match_id, player["user_id"], opponent["user_id"], match["difficulty"], outcome,
              before.mmr, after.mmr, before.deviation, after.deviation, before.volatility, after.volatility, placements))


def advance_ready_windows(conn):
    """Server clock starts lobby and subsequent rounds after readiness or the one-minute window."""
    with conn.transaction():
        matches = conn.execute("""
          SELECT m.id, m.status, m.difficulty, m.player_one_id, m.player_two_id,
            CASE WHEN m.status = 'waiting' THEN 0 ELSE (SELECT min(round_number) FROM match_rounds WHERE match_id = m.id AND status = 'pending') END AS next_round,
            CASE WHEN m.status = 'waiting' THEN m.lobby_ends_at ELSE m.ready_window_ends_at END AS deadline
          FROM matches m WHERE m.status IN ('waiting', 'between_rounds') FOR UPDATE SKIP LOCKED
        """).fetchall()
        for match in matches:
            if match["next_round"] is None:
                continue
            ready = conn.execute("SELECT count(*) AS count FROM match_ready_ups WHERE match_id = %s AND round_number = %s", (match["id"], match["next_round"])).fetchone()["count"]
            if ready < 2 and match["deadline"] > conn.execute("SELECT now() AS now").fetchone()["now"]:
                continue
            seconds = {"easy": 300, "medium": 600, "advanced": 1200}[match["difficulty"]]
            conn.execute("UPDATE matches SET status = 'active', started_at = COALESCE(started_at, now()), lobby_ends_at = NULL, ready_window_ends_at = NULL WHERE id = %s", (match["id"],))
            conn.execute("UPDATE match_rounds SET status = 'active', starts_at = now(), ends_at = now() + (%s * interval '1 second') WHERE match_id = %s AND round_number = %s", (seconds, match["id"], match["next_round"]))


def settle_completed_matches(conn):
    """Forfeits are completed by API handlers; apply their rating change once in the worker."""
    with conn.transaction():
        matches = conn.execute("""
          SELECT m.id, m.winner_id FROM matches m
          WHERE m.status = 'completed' AND NOT EXISTS (SELECT 1 FROM rating_events e WHERE e.match_id = m.id)
          FOR UPDATE SKIP LOCKED
        """).fetchall()
        for match in matches:
            apply_match_ratings(conn, match["id"], match["winner_id"])


def forfeit_expired_disconnects(conn):
    with conn.transaction():
        matches = conn.execute("""
          SELECT id, player_one_id, player_two_id, player_one_disconnected_at, player_two_disconnected_at
          FROM matches WHERE status IN ('waiting', 'active', 'between_rounds')
            AND (player_one_disconnected_at <= now() - interval '60 seconds' OR player_two_disconnected_at <= now() - interval '60 seconds')
          FOR UPDATE SKIP LOCKED
        """).fetchall()
        for match in matches:
            first_expired = match["player_one_disconnected_at"] and match["player_one_disconnected_at"] <= conn.execute("SELECT now() - interval '60 seconds' AS cutoff").fetchone()["cutoff"]
            second_expired = match["player_two_disconnected_at"] and match["player_two_disconnected_at"] <= conn.execute("SELECT now() - interval '60 seconds' AS cutoff").fetchone()["cutoff"]
            winner = None if first_expired and second_expired else match["player_two_id"] if first_expired else match["player_one_id"]
            conn.execute("UPDATE matches SET status = 'completed', winner_id = %s, forfeited_at = now(), forfeit_reason = 'disconnect', completed_at = now() WHERE id = %s", (winner, match["id"]))


def purge_expired_messages(conn):
    """Chat is retained for moderation for exactly 90 days, then permanently removed."""
    with conn.transaction():
        conn.execute("DELETE FROM match_messages WHERE created_at < now() - interval '90 days'")


def auto_submit_expired_rounds(conn):
    """Lock saved drafts at expiry. A missing draft falls back to the published starter code."""
    with conn.transaction():
        rounds = conn.execute("""
          SELECT r.id, r.problem_id, m.player_one_id, m.player_two_id, p.starter_code
          FROM match_rounds r JOIN matches m ON m.id = r.match_id JOIN problems p ON p.id = r.problem_id
          WHERE r.status = 'active' AND r.ends_at <= now() FOR UPDATE OF r SKIP LOCKED
        """).fetchall()
        for round_data in rounds:
            for user_id in (round_data["player_one_id"], round_data["player_two_id"]):
                exists = conn.execute("SELECT 1 FROM submissions WHERE match_round_id = %s AND user_id = %s", (round_data["id"], user_id)).fetchone()
                if exists:
                    continue
                draft = conn.execute("SELECT source_code FROM round_drafts WHERE match_round_id = %s AND user_id = %s", (round_data["id"], user_id)).fetchone()
                submission_id = str(uuid.uuid4())
                conn.execute("""
                  INSERT INTO submissions (id, user_id, problem_id, match_round_id, source_code, is_auto_submission)
                  VALUES (%s, %s, %s, %s, %s, true)
                """, (submission_id, user_id, round_data["problem_id"], round_data["id"], draft["source_code"] if draft else round_data["starter_code"]))
                conn.execute("INSERT INTO judge_jobs (id, submission_id) VALUES (%s, %s)", (str(uuid.uuid4()), submission_id))


def auto_submit_expired_placements(conn):
    with conn.transaction():
        attempts = conn.execute("""
          SELECT a.id, a.user_id, a.problem_id, p.starter_code FROM placement_attempts a
          JOIN problems p ON p.id = a.problem_id WHERE a.status = 'active' AND a.ends_at <= now()
          FOR UPDATE OF a SKIP LOCKED
        """).fetchall()
        for attempt in attempts:
            exists = conn.execute("SELECT 1 FROM submissions WHERE placement_attempt_id = %s", (attempt["id"],)).fetchone()
            if exists:
                continue
            submission_id = str(uuid.uuid4())
            conn.execute("INSERT INTO submissions (id, user_id, problem_id, placement_attempt_id, source_code, is_auto_submission) VALUES (%s, %s, %s, %s, %s, true)", (submission_id, attempt["user_id"], attempt["problem_id"], attempt["id"], attempt["starter_code"]))
            conn.execute("INSERT INTO judge_jobs (id, submission_id) VALUES (%s, %s)", (str(uuid.uuid4()), submission_id))


def fail_job(conn, job_id, error):
    with conn.transaction():
        conn.execute("""
          UPDATE judge_jobs SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'queued' END,
            available_at = now() + interval '15 seconds', last_error = %s, locked_at = NULL, locked_by = NULL
          WHERE id = %s
        """, (str(error)[:2000], job_id))


def main():
    while True:
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            advance_ready_windows(conn)
            auto_submit_expired_rounds(conn)
            auto_submit_expired_placements(conn)
            forfeit_expired_disconnects(conn)
            settle_completed_matches(conn)
            purge_expired_messages(conn)
            job = claim_job(conn)
            if not job:
                time.sleep(POLL_SECONDS)
                continue
            try:
                result = execute(load_submission(conn, job["submission_id"]))
                persist_result(conn, job["id"], job["submission_id"], result)
            except Exception as error:
                fail_job(conn, job["id"], error)


if __name__ == "__main__":
    main()
