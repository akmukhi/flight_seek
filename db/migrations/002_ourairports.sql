BEGIN;

CREATE TABLE IF NOT EXISTS ref_country (
  code char(2) PRIMARY KEY,
  name text NOT NULL,
  continent text,
  wikipedia_link text,
  keywords text
);

CREATE TABLE IF NOT EXISTS ref_region (
  code text PRIMARY KEY,
  local_code text,
  name text NOT NULL,
  continent text,
  iso_country char(2) NOT NULL REFERENCES ref_country(code) ON UPDATE CASCADE,
  wikipedia_link text,
  keywords text
);

CREATE INDEX IF NOT EXISTS ref_region_iso_country_idx ON ref_region(iso_country);

CREATE TABLE IF NOT EXISTS airport (
  id bigserial PRIMARY KEY,
  ourairports_id integer UNIQUE,

  ident text NOT NULL,
  type text NOT NULL,
  name text NOT NULL,

  latitude_deg double precision,
  longitude_deg double precision,
  elevation_ft integer,

  continent text,
  iso_country char(2) REFERENCES ref_country(code) ON UPDATE CASCADE,
  iso_region text REFERENCES ref_region(code) ON UPDATE CASCADE,
  municipality text,
  scheduled_service boolean,

  gps_code text,
  iata_code char(3),
  local_code text,

  home_link text,
  wikipedia_link text,
  keywords text,

  geom geography(Point, 4326),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS airport_ident_idx ON airport(ident);
CREATE INDEX IF NOT EXISTS airport_iata_code_idx ON airport(iata_code);
CREATE INDEX IF NOT EXISTS airport_iso_country_idx ON airport(iso_country);
CREATE INDEX IF NOT EXISTS airport_iso_region_idx ON airport(iso_region);
CREATE INDEX IF NOT EXISTS airport_geom_gix ON airport USING gist(geom);

COMMIT;

