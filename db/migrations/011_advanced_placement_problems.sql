-- Original development exercises: five distinct Advanced placement problems.
-- Additive and repeatable; existing published problems and user progress are untouched.
BEGIN;
WITH seeds (slug, title, entrypoint, statement, starter, solution, tests) AS (
  VALUES
  ('increasing-subsequence', 'Increasing Subsequence', 'increasing_length',
   $statement$Return the length of the longest strictly increasing subsequence of `values`.

A subsequence preserves input order but may skip elements. Equal values do not extend it.
Return 0 for an empty list.

Constraints: 0 <= len(values) <= 10000; each value is an integer from -1000000 to 1000000.$statement$,
   E'def increasing_length(values):\n    pass\n',
   $python$def increasing_length(values):
    from bisect import bisect_left
    tails = []
    for value in values:
        index = bisect_left(tails, value)
        if index == len(tails):
            tails.append(value)
        else:
            tails[index] = value
    return len(tails)
$python$,
   '[{"args":[[3,1,2,5,4]],"output":3,"public":true},
     {"args":[[2,2,2]],"output":1,"public":true},
     {"args":[[]],"output":0,"public":false},
     {"args":[[9,7,5,3,1]],"output":1,"public":false},
     {"args":[[-3,-1,-2,0,2]],"output":4,"public":false},
     {"args":[[1,2,3,4,5]],"output":5,"public":false},
     {"args":[[10,9,2,5,3,7,101,18]],"output":4,"public":false}]'::jsonb),
  ('edit-distance', 'Edit Distance', 'edit_distance',
   $statement$Return the minimum number of single-character insertions, deletions, and replacements needed to transform `source` into `target`.

Each operation costs 1. Matching characters cost 0. Swapping characters is not a single operation.

Constraints: source and target contain lowercase English letters; each length is from 0 to 300.$statement$,
   E'def edit_distance(source, target):\n    pass\n',
   $python$def edit_distance(source, target):
    previous = list(range(len(target) + 1))
    for row, left in enumerate(source, 1):
        current = [row]
        for col, right in enumerate(target, 1):
            current.append(min(current[-1] + 1, previous[col] + 1,
                               previous[col - 1] + (left != right)))
        previous = current
    return previous[-1]
$python$,
   '[{"args":["cat","cut"],"output":1,"public":true},
     {"args":["","abc"],"output":3,"public":true},
     {"args":["",""],"output":0,"public":false},
     {"args":["same","same"],"output":0,"public":false},
     {"args":["abc",""],"output":3,"public":false},
     {"args":["kitten","sitting"],"output":3,"public":false},
     {"args":["ab","ba"],"output":2,"public":false}]'::jsonb),
  ('weighted-schedule', 'Weighted Schedule', 'max_reward',
   $statement$Choose non-overlapping jobs with the greatest total reward and return that reward.

Each job is `[start, end, reward]`. A job occupies the half-open interval `[start, end)`, so a job ending at time t may be followed by one starting at t. Jobs are not necessarily sorted. Each job may be chosen at most once. Choosing no jobs is allowed.

Constraints: 0 <= len(jobs) <= 10000; 0 <= start < end <= 1000000; 0 <= reward <= 1000000.$statement$,
   E'def max_reward(jobs):\n    pass\n',
   $python$def max_reward(jobs):
    from bisect import bisect_right
    ordered = sorted(jobs, key=lambda job: job[1])
    ends = [job[1] for job in ordered]
    best = [0]
    for index, (start, end, reward) in enumerate(ordered):
        compatible = bisect_right(ends, start, 0, index)
        best.append(max(best[-1], best[compatible] + reward))
    return best[-1]
$python$,
   '[{"args":[[[1,3,4],[3,5,6],[1,5,9]]],"output":10,"public":true},
     {"args":[[]],"output":0,"public":true},
     {"args":[[[4,6,7],[0,2,3],[2,4,5]]],"output":15,"public":false},
     {"args":[[[0,10,20],[1,2,4],[2,3,4]]],"output":20,"public":false},
     {"args":[[[0,2,3],[0,2,8],[2,3,2]]],"output":10,"public":false},
     {"args":[[[0,1,0]]],"output":0,"public":false},
     {"args":[[[0,3,5],[1,4,6],[3,5,5],[4,6,4],[5,7,5]]],"output":15,"public":false}]'::jsonb)
), inserted AS (
  INSERT INTO problems (id, slug, title, difficulty, format, entrypoint,
    statement_markdown, starter_code, reference_solution, time_limit_ms,
    memory_limit_mb, author_name, content_license, published_at)
  SELECT gen_random_uuid(), slug, title, 'advanced', 'function', entrypoint,
    statement, starter, solution, 2000, 128, 'CodeDuel Team', 'original', now()
  FROM seeds ON CONFLICT (slug) DO NOTHING RETURNING id, slug
)
INSERT INTO problem_tests (id, problem_id, input_data, expected_output, is_public, weight, ordinal)
SELECT gen_random_uuid(), inserted.id,
  jsonb_build_object('args', test.value->'args')::text,
  (test.value->'output')::text, (test.value->>'public')::boolean, 1, test.ordinal
FROM inserted JOIN seeds USING (slug)
CROSS JOIN LATERAL jsonb_array_elements(seeds.tests) WITH ORDINALITY AS test(value, ordinal);

-- Boundary cases discourage accidental quadratic/exponential implementations and
-- cover empty/duplicate handling separately from realistic input sizes.
WITH boundaries (slug, ordinal, input_data, expected_output) AS (
  SELECT 'increasing-subsequence', 8,
    jsonb_build_object('args', jsonb_build_array(jsonb_agg(n ORDER BY n)))::text, '10000'
    FROM generate_series(1,10000) AS s(n)
  UNION ALL
  SELECT 'increasing-subsequence', 9,
    jsonb_build_object('args', jsonb_build_array(jsonb_agg(n ORDER BY n DESC)))::text, '1'
    FROM generate_series(1,10000) AS s(n)
  UNION ALL
  SELECT 'edit-distance', 8,
    jsonb_build_object('args', jsonb_build_array(repeat('a',300),repeat('b',300)))::text, '300'
  UNION ALL
  SELECT 'edit-distance', 9,
    jsonb_build_object('args', jsonb_build_array(repeat('ab',150),repeat('ba',150)))::text, '2'
  UNION ALL
  SELECT 'weighted-schedule', 8,
    jsonb_build_object('args', jsonb_build_array(jsonb_agg(jsonb_build_array(2*n,2*n+1,1000000) ORDER BY n DESC)))::text, '10000000000'
    FROM generate_series(1,10000) AS s(n)
  UNION ALL
  SELECT 'weighted-schedule', 9,
    jsonb_build_object('args', jsonb_build_array(jsonb_agg(jsonb_build_array(n,n+10000,1) ORDER BY n)))::text, '1'
    FROM generate_series(1,10000) AS s(n)
)
INSERT INTO problem_tests (id, problem_id, input_data, expected_output, is_public, weight, ordinal)
SELECT gen_random_uuid(), p.id, b.input_data, b.expected_output, false, 1, b.ordinal
FROM boundaries b JOIN problems p ON p.slug=b.slug
ON CONFLICT (problem_id, ordinal) DO NOTHING;
COMMIT;
