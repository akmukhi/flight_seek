BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_status') THEN
    CREATE TYPE issue_status AS ENUM ('open', 'resolved', 'dismissed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_severity') THEN
    CREATE TYPE issue_severity AS ENUM ('info', 'minor', 'major', 'critical');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS issue_type (
  key text PRIMARY KEY,
  description text
);

-- Seed a few common types (safe to re-run)
INSERT INTO issue_type(key, description) VALUES
  ('weather', 'Weather-related disruption'),
  ('atc', 'Air traffic control program / flow constraint'),
  ('security', 'Security incident or checkpoint disruption'),
  ('airport_ops', 'Airport operations disruption'),
  ('airline_ops', 'Airline operations disruption'),
  ('notam', 'NOTAM or advisory affecting operations'),
  ('other', 'Other / uncategorized')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS issue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key text NOT NULL REFERENCES issue_type(key) ON UPDATE CASCADE,

  title text NOT NULL,
  summary text,

  status issue_status NOT NULL DEFAULT 'open',
  severity issue_severity NOT NULL DEFAULT 'info',

  starts_at timestamptz,
  ends_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS issue_status_idx ON issue(status);
CREATE INDEX IF NOT EXISTS issue_type_key_idx ON issue(type_key);
CREATE INDEX IF NOT EXISTS issue_updated_at_idx ON issue(updated_at DESC);

CREATE TABLE IF NOT EXISTS issue_airport (
  issue_id uuid NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
  airport_id bigint NOT NULL REFERENCES airport(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'affected',
  PRIMARY KEY (issue_id, airport_id, role)
);

CREATE INDEX IF NOT EXISTS issue_airport_airport_id_idx ON issue_airport(airport_id);

CREATE TABLE IF NOT EXISTS issue_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issue(id) ON DELETE CASCADE,

  source text NOT NULL,
  source_ref text,
  kind text NOT NULL,

  published_at timestamptz,
  observed_at timestamptz NOT NULL DEFAULT now(),
  effective_start timestamptz,
  effective_end timestamptz,

  headline text,
  details text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS issue_event_issue_id_idx ON issue_event(issue_id);
CREATE INDEX IF NOT EXISTS issue_event_observed_at_idx ON issue_event(observed_at DESC);
CREATE INDEX IF NOT EXISTS issue_event_source_ref_idx ON issue_event(source, source_ref);

COMMIT;

