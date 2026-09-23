BEGIN;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
WITH topics(slug, tags) AS (VALUES
  ('digit-sum', ARRAY['math','loops']),
  ('unique-sorted', ARRAY['arrays','sorting','sets']),
  ('word-count', ARRAY['strings']),
  ('toggle-case', ARRAY['strings']),
  ('running-total', ARRAY['arrays','loops','prefix-sums']),
  ('clamp-value', ARRAY['math','conditions']),
  ('pair-indices', ARRAY['arrays','hash-maps']),
  ('balanced-brackets', ARRAY['strings','stacks']),
  ('rotate-right', ARRAY['arrays']),
  ('merge-ranges', ARRAY['arrays','intervals']),
  ('top-frequency', ARRAY['arrays','hash-maps','counting']),
  ('longest-run', ARRAY['arrays','loops']),
  ('minimum-coins', ARRAY['dynamic-programming','math']),
  ('grid-shortest-path', ARRAY['graphs','grids','bfs']),
  ('increasing-subsequence', ARRAY['arrays','dynamic-programming','binary-search']),
  ('edit-distance', ARRAY['strings','dynamic-programming']),
  ('weighted-schedule', ARRAY['intervals','dynamic-programming','binary-search'])
)
UPDATE problems p SET tags = ARRAY(SELECT DISTINCT unnest(p.tags || t.tags) ORDER BY 1)
FROM topics t WHERE p.slug=t.slug;
CREATE INDEX IF NOT EXISTS problems_tags_idx ON problems USING GIN (tags);
COMMIT;
