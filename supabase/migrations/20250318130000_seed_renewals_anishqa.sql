-- Seed renewals for anishqa queendom (with renewal dates)

INSERT INTO public.renewals (client_name, "group", queendom, created_at) VALUES
  ('Sanjeev Barnwal', 'anishqa', 'anishqa', '2026-03-04'::timestamptz),
  ('Gurava Reddy', 'anishqa', 'anishqa', '2026-03-06'::timestamptz),
  ('Vishal Karamchandani', 'anishqa', 'anishqa', '2026-03-06'::timestamptz),
  ('Aniruddha Khopde', 'anishqa', 'anishqa', '2026-03-07'::timestamptz),
  ('Priyanka Agrawal', 'anishqa', 'anishqa', '2026-03-09'::timestamptz),
  ('Manoj Laddha', 'anishqa', 'anishqa', '2026-03-11'::timestamptz),
  ('Rahul Goel', 'anishqa', 'anishqa', '2026-03-16'::timestamptz),
  ('Jainita Shah', 'anishqa', 'anishqa', '2026-03-17'::timestamptz);

-- Seed anishqa members (Latest Assignments section)
INSERT INTO public.members (client_name, "group", queendom, created_at) VALUES
  ('Vishal Karamchandani', 'anishqa', 'anishqa', '2026-03-06'::timestamptz),
  ('Aniruddha Khopde', 'anishqa', 'anishqa', '2026-03-07'::timestamptz),
  ('Priyanka Agarwal', 'anishqa', 'anishqa', '2026-03-09'::timestamptz),
  ('Rahul Goel', 'anishqa', 'anishqa', '2026-03-16'::timestamptz),
  ('Jainita Shah', 'anishqa', 'anishqa', '2026-03-17'::timestamptz);
