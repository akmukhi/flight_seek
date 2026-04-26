import { parse } from "csv-parse/sync";
import { getPool } from "./db";

const OURAIRPORTS = {
  countries: "https://ourairports.com/data/countries.csv",
  regions: "https://ourairports.com/data/regions.csv",
  airports: "https://ourairports.com/data/airports.csv",
} as const;

type CsvRow = Record<string, string>;

async function fetchCsv(url: string): Promise<CsvRow[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  }) as CsvRow[];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toNull(s: string | undefined) {
  const v = (s ?? "").trim();
  return v === "" ? null : v;
}

function toInt(s: string | undefined) {
  const v = toNull(s);
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function toFloat(s: string | undefined) {
  const v = toNull(s);
  if (v === null) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toBool(s: string | undefined) {
  const v = toNull(s);
  if (v === null) return null;
  return v.toLowerCase() === "yes";
}

async function upsertCountries(rows: CsvRow[]) {
  const pool = getPool();
  const cols = ["code", "name", "continent", "wikipedia_link", "keywords"] as const;

  for (const batch of chunk(rows, 500)) {
    const values: unknown[] = [];
    const tuples = batch
      .map((r, i) => {
        const base = i * cols.length;
        values.push(
          toNull(r.code),
          toNull(r.name),
          toNull(r.continent),
          toNull(r.wikipedia_link),
          toNull(r.keywords),
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
      })
      .join(", ");

    await pool.query(
      `
      INSERT INTO ref_country(${cols.join(", ")})
      VALUES ${tuples}
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        continent = EXCLUDED.continent,
        wikipedia_link = EXCLUDED.wikipedia_link,
        keywords = EXCLUDED.keywords
      `,
      values,
    );
  }
}

async function upsertRegions(rows: CsvRow[]) {
  const pool = getPool();
  const cols = [
    "code",
    "local_code",
    "name",
    "continent",
    "iso_country",
    "wikipedia_link",
    "keywords",
  ] as const;

  for (const batch of chunk(rows, 500)) {
    const values: unknown[] = [];
    const tuples = batch
      .map((r, i) => {
        const base = i * cols.length;
        values.push(
          toNull(r.code),
          toNull(r.local_code),
          toNull(r.name),
          toNull(r.continent),
          toNull(r.iso_country),
          toNull(r.wikipedia_link),
          toNull(r.keywords),
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
      })
      .join(", ");

    await pool.query(
      `
      INSERT INTO ref_region(${cols.join(", ")})
      VALUES ${tuples}
      ON CONFLICT (code) DO UPDATE SET
        local_code = EXCLUDED.local_code,
        name = EXCLUDED.name,
        continent = EXCLUDED.continent,
        iso_country = EXCLUDED.iso_country,
        wikipedia_link = EXCLUDED.wikipedia_link,
        keywords = EXCLUDED.keywords
      `,
      values,
    );
  }
}

async function upsertAirportsWithGeom(rows: CsvRow[]) {
  const pool = getPool();
  const cols = [
    "ourairports_id",
    "ident",
    "type",
    "name",
    "latitude_deg",
    "longitude_deg",
    "elevation_ft",
    "continent",
    "iso_country",
    "iso_region",
    "municipality",
    "scheduled_service",
    "gps_code",
    "iata_code",
    "local_code",
    "home_link",
    "wikipedia_link",
    "keywords",
  ] as const;

  for (const batch of chunk(rows, 300)) {
    const values: unknown[] = [];
    const tuples = batch
      .map((r, i) => {
        const base = i * (cols.length + 2);
        const lat = toFloat(r.latitude_deg);
        const lon = toFloat(r.longitude_deg);

        values.push(
          toInt(r.id),
          toNull(r.ident) ?? "",
          toNull(r.type) ?? "",
          toNull(r.name) ?? "",
          lat,
          lon,
          toInt(r.elevation_ft),
          toNull(r.continent),
          toNull(r.iso_country),
          toNull(r.iso_region),
          toNull(r.municipality),
          toBool(r.scheduled_service),
          toNull(r.gps_code),
          toNull(r.iata_code),
          toNull(r.local_code),
          toNull(r.home_link),
          toNull(r.wikipedia_link),
          toNull(r.keywords),
          lat,
          lon,
        );

        const airportColsPlaceholders = Array.from(
          { length: cols.length },
          (_, j) => `$${base + j + 1}`,
        ).join(", ");
        const latParam = `$${base + cols.length + 1}`;
        const lonParam = `$${base + cols.length + 2}`;
        const geomExpr = `CASE WHEN ${latParam} IS NULL OR ${lonParam} IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(${lonParam}, ${latParam}), 4326)::geography END`;

        return `(${airportColsPlaceholders}, ${geomExpr}, now())`;
      })
      .join(", ");

    await pool.query(
      `
      INSERT INTO airport(${cols.join(", ")}, geom, updated_at)
      VALUES ${tuples}
      ON CONFLICT (ourairports_id) DO UPDATE SET
        ident = EXCLUDED.ident,
        type = EXCLUDED.type,
        name = EXCLUDED.name,
        latitude_deg = EXCLUDED.latitude_deg,
        longitude_deg = EXCLUDED.longitude_deg,
        elevation_ft = EXCLUDED.elevation_ft,
        continent = EXCLUDED.continent,
        iso_country = EXCLUDED.iso_country,
        iso_region = EXCLUDED.iso_region,
        municipality = EXCLUDED.municipality,
        scheduled_service = EXCLUDED.scheduled_service,
        gps_code = EXCLUDED.gps_code,
        iata_code = EXCLUDED.iata_code,
        local_code = EXCLUDED.local_code,
        home_link = EXCLUDED.home_link,
        wikipedia_link = EXCLUDED.wikipedia_link,
        keywords = EXCLUDED.keywords,
        geom = EXCLUDED.geom,
        updated_at = now()
      `,
      values,
    );
  }
}

async function main() {
  console.log("Downloading OurAirports CSVs...");
  const [countries, regions, airports] = await Promise.all([
    fetchCsv(OURAIRPORTS.countries),
    fetchCsv(OURAIRPORTS.regions),
    fetchCsv(OURAIRPORTS.airports),
  ]);

  console.log(`Countries: ${countries.length}`);
  console.log(`Regions: ${regions.length}`);
  console.log(`Airports: ${airports.length}`);

  console.log("Upserting countries...");
  await upsertCountries(countries);
  console.log("Upserting regions...");
  await upsertRegions(regions);
  console.log("Upserting airports...");
  await upsertAirportsWithGeom(airports);

  const pool = getPool();
  await pool.end();

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

