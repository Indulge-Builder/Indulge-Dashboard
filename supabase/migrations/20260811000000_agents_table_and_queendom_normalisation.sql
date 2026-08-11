-- ─────────────────────────────────────────────────────────────────────────────
-- Settings page groundwork (2026-08-11)
--
-- 1. `agents` — moves the concierge roster out of lib/agentRoster.ts (which
--    required a code edit + redeploy for every joiner/leaver) into a table the
--    Settings UI can edit. The code keeps the hardcoded arrays as a fallback,
--    so an empty/unreachable table leaves the TV exactly as it is today.
--
-- 2. Queendom label normalisation for `renewals` and `members` ONLY.
--    Today: renewals stores "ananyshree" / "anishqa", members stores
--    "Ananyshree's Queendom" / "Anishqa's Queendom". Both become the form
--    `clients.group` already uses: "Ananyshree Queendom" / "Anishqa Queendom".
--
--    `tickets`, `jokers`, `clients` and `onboarding_conversion_ledger` are
--    DELIBERATELY untouched — they are written by external webhooks/syncs.
--
--    Safety: the only reader of renewals/members is /api/renewals-panel, which
--    resolves the label through normalizeQueendom() — a case-insensitive
--    `.includes()` match. "Ananyshree Queendom" resolves the same as both the
--    old forms, so the panel's output is unchanged by this migration.
--
--    Rows whose label matches neither queendom (e.g. the single "Unassigned"
--    member) are left exactly as they are.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══ 1. agents ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.agents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Must match `tickets.agent_name` (matching is case-insensitive, so casing
  -- here is a display choice only).
  name        TEXT        NOT NULL,
  queendom    TEXT        NOT NULL,
  -- 'agent' = concierge leaderboard seat, 'joker' = the queendom's Joker.
  role        TEXT        NOT NULL DEFAULT 'agent',
  -- Soft-remove: an inactive agent leaves the TV but keeps their history
  -- attributable and can be restored without retyping the name.
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agents_queendom_check   CHECK (queendom IN ('ananyshree', 'anishqa')),
  CONSTRAINT agents_role_check       CHECK (role IN ('agent', 'joker')),
  CONSTRAINT agents_name_not_blank   CHECK (btrim(name) <> '')
);

-- Ticket attribution lowercases both sides, so uniqueness must be
-- case-insensitive too: "Neha Sah" + "neha sah" as two rows would show the
-- same agent twice on the leaderboard, each with the full ticket count.
CREATE UNIQUE INDEX IF NOT EXISTS agents_name_lower_key
  ON public.agents (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS agents_queendom_role_idx
  ON public.agents (queendom, role, is_active);

CREATE OR REPLACE FUNCTION public.agents_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agents_touch_updated_at ON public.agents;
CREATE TRIGGER agents_touch_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.agents_touch_updated_at();


-- ─── RLS (same pattern as tickets / renewals / jokers) ───────────────────────
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agents_select_anon" ON public.agents;
CREATE POLICY "agents_select_anon"
  ON public.agents FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "agents_all_authenticated" ON public.agents;
CREATE POLICY "agents_all_authenticated"
  ON public.agents FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ─── Realtime ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'agents'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;
    END IF;
  END IF;
END $$;


-- ─── Seed: the roster exactly as lib/agentRoster.ts has it today ─────────────
-- Intentionally seeded as-is so applying this migration changes nothing on the
-- TV. Agents currently filing tickets but absent from the roster (Anshika Eark,
-- Sagar Ali, Savio Francis Fernandes, …) are NOT auto-added — that is a roster
-- decision, now makeable from the Settings page.

INSERT INTO public.agents (name, queendom, role, sort_order) VALUES
  ('Neha Sah',          'anishqa',    'agent', 1),
  ('Pranav Gadekar',    'anishqa',    'agent', 2),
  ('Dhanush K',         'anishqa',    'agent', 3),
  ('Charlotte Dias',    'anishqa',    'agent', 4),
  ('Ria Pujhari',       'anishqa',    'agent', 5),
  ('Rupali Chodankar',  'anishqa',    'agent', 6),
  ('Eeti Srinivsulu',   'anishqa',    'agent', 7),
  ('Ekta Nihalani',     'anishqa',    'agent', 8),
  ('Rutika Kale',       'anishqa',    'agent', 9),
  ('Sanika Ahire',      'ananyshree', 'agent', 1),
  ('Sakshi Bhutkar',    'ananyshree', 'agent', 2),
  ('Poorti Gulati',     'ananyshree', 'agent', 3),
  ('Marlene Fernandes', 'ananyshree', 'agent', 4),
  ('Ajith Sajan',       'ananyshree', 'agent', 5),
  ('Khushi Shah',       'ananyshree', 'agent', 6),
  ('Palak Kataria',     'ananyshree', 'agent', 7),
  ('Athul Jose',        'ananyshree', 'agent', 8),
  ('Aditya Sonde',      'ananyshree', 'agent', 9)
ON CONFLICT DO NOTHING;

-- Jokers. NOTE the anishqa correction: lib/agentRoster.ts names "Shruti Sharma",
-- who has ZERO rows in `jokers`. The 694 anishqa joker rows all belong to
-- "Anil Talluri", so anishqa's Joker panel has been reading 0 for everything.
-- Seeded with the name the data actually uses; editable from Settings if wrong.
INSERT INTO public.agents (name, queendom, role, sort_order) VALUES
  ('Lilian Albrecht', 'ananyshree', 'joker', 1),
  ('Anil Talluri',    'anishqa',    'joker', 1)
ON CONFLICT DO NOTHING;


-- ═══ 2. renewals / members queendom normalisation ════════════════════════════

-- ─── Self-healing trigger ────────────────────────────────────────────────────
-- Deliberately a normaliser, NOT a CHECK constraint: these two tables are fed
-- by an external sync (newest rows Aug 8 / Aug 10) that this repo does not
-- control. A CHECK would make that sync start failing; this rewrites whatever
-- it sends into the canonical label instead, so the streamlining holds without
-- anything upstream needing to change.
--
-- Also strips stray whitespace/newlines from client_name — several rows carry a
-- trailing "\n" from the sheet sync and it renders on the TV.

CREATE OR REPLACE FUNCTION public.normalise_queendom_label()
RETURNS TRIGGER AS $$
DECLARE
  raw       TEXT := lower(coalesce(NEW."group", '') || ' ' || coalesce(NEW.queendom, ''));
  canonical TEXT;
BEGIN
  IF raw LIKE '%ananyshree%' THEN
    canonical := 'Ananyshree Queendom';
  ELSIF raw LIKE '%anishqa%' THEN
    canonical := 'Anishqa Queendom';
  END IF;

  -- Unrecognised labels (e.g. 'Unassigned') pass through untouched.
  IF canonical IS NOT NULL THEN
    NEW."group"  := canonical;
    NEW.queendom := canonical;
  END IF;

  IF NEW.client_name IS NOT NULL THEN
    NEW.client_name := btrim(NEW.client_name, E' \t\r\n');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS renewals_normalise_queendom ON public.renewals;
CREATE TRIGGER renewals_normalise_queendom
  BEFORE INSERT OR UPDATE ON public.renewals
  FOR EACH ROW EXECUTE FUNCTION public.normalise_queendom_label();

DROP TRIGGER IF EXISTS members_normalise_queendom ON public.members;
CREATE TRIGGER members_normalise_queendom
  BEFORE INSERT OR UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.normalise_queendom_label();


-- ─── Backfill existing rows ──────────────────────────────────────────────────
-- The trigger fires on UPDATE, so a no-op touch rewrites every row through the
-- same normaliser the trigger uses — one code path, no chance of the backfill
-- and the trigger disagreeing.
--
-- "ananyshree" and "anishqa" are not substrings of each other, so the two
-- patterns can never both match a row.

UPDATE public.renewals SET id = id
 WHERE lower(coalesce("group", '') || ' ' || coalesce(queendom, '')) LIKE '%ananyshree%'
    OR lower(coalesce("group", '') || ' ' || coalesce(queendom, '')) LIKE '%anishqa%'
    OR client_name IS DISTINCT FROM btrim(client_name, E' \t\r\n');

UPDATE public.members SET id = id
 WHERE lower(coalesce("group", '') || ' ' || coalesce(queendom, '')) LIKE '%ananyshree%'
    OR lower(coalesce("group", '') || ' ' || coalesce(queendom, '')) LIKE '%anishqa%'
    OR client_name IS DISTINCT FROM btrim(client_name, E' \t\r\n');
