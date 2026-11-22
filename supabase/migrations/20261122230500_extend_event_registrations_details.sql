-- Keep event registrations useful for attendance lists and team-based participation.
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS registration_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS team_name text,
  ADD COLUMN IF NOT EXISTS participation_type text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS shift text,
  ADD COLUMN IF NOT EXISTS course text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS event_registrations_event_created_idx
  ON public.event_registrations (event_id, created_at DESC);
