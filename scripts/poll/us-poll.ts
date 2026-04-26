import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { getPool } from "../db/db";
import { cacheSetJson } from "@/lib/cache";
import { fetchFaaNasStatus } from "@/lib/adapters/us/faa";
import { fetchMyTsaWaitTimes } from "@/lib/adapters/us/mytsa";
import {
  fetchNoaaLatestObservationFromStations,
  fetchNoaaPoint,
} from "@/lib/adapters/us/noaa";

type AirportRow = {
  id: number;
  iata_code: string;
  latitude_deg: number | null;
  longitude_deg: number | null;
};

const TTL = {
  faa: 60, // seconds
  tsa: 5 * 60,
  noaaPoint: 24 * 60 * 60,
  noaaObs: 10 * 60,
  snapshot: 60,
} as const;

function key(parts: string[]) {
  return ["cache", "us", ...parts].join(":");
}

async function listUsAirports(limit: number): Promise<AirportRow[]> {
  const pool = getPool();
  const res = await pool.query<AirportRow>(
    `
    SELECT id, iata_code, latitude_deg, longitude_deg
    FROM airport
    WHERE iso_country = 'US'
      AND iata_code IS NOT NULL
      AND iata_code <> ''
    ORDER BY iata_code ASC
    LIMIT $1
    `,
    [limit],
  );
  return res.rows.map((r) => ({
    ...r,
    iata_code: r.iata_code.trim().toUpperCase(),
  }));
}

async function pollOnce(airports: AirportRow[]) {
  const startedAt = new Date().toISOString();

  // FAA NASSTATUS is a single nationwide XML snapshot
  const faa = await fetchFaaNasStatus();
  const faaByAirport = new Map<string, unknown[]>();
  for (const d of faa.delays) {
    const k = d.airport.toUpperCase();
    const prev = faaByAirport.get(k) ?? [];
    prev.push(d);
    faaByAirport.set(k, prev);
  }
  await cacheSetJson(key(["faa", "nasstatus"]), faa, TTL.faa);

  for (const ap of airports) {
    const iata = ap.iata_code;

    // MyTSA (per-airport)
    let tsa: unknown = null;
    try {
      tsa = await fetchMyTsaWaitTimes(iata);
      await cacheSetJson(key(["tsa", iata]), tsa, TTL.tsa);
    } catch (e) {
      tsa = { error: String(e) };
    }

    // NOAA (per-airport point + latest observation)
    let noaa: unknown = null;
    if (ap.latitude_deg != null && ap.longitude_deg != null) {
      try {
        const point = await fetchNoaaPoint(ap.latitude_deg, ap.longitude_deg);
        await cacheSetJson(key(["noaa", "point", iata]), point, TTL.noaaPoint);
        const obs = point.observationStationsUrl
          ? await fetchNoaaLatestObservationFromStations(point.observationStationsUrl)
          : null;
        await cacheSetJson(key(["noaa", "obs", iata]), obs, TTL.noaaObs);
        noaa = { point, obs };
      } catch (e) {
        noaa = { error: String(e) };
      }
    }

    const snapshot = {
      airport: iata,
      startedAt,
      generatedAt: new Date().toISOString(),
      faa: {
        updatedAt: faa.updatedAt,
        delays: faaByAirport.get(iata) ?? [],
      },
      tsa,
      noaa,
    };

    await cacheSetJson(key(["snapshot", "airport", iata]), snapshot, TTL.snapshot);
  }
}

async function main() {
  const limit = Number.parseInt(process.env.POLL_AIRPORT_LIMIT ?? "80", 10);
  const intervalSeconds = Number.parseInt(process.env.POLL_INTERVAL_SECONDS ?? "60", 10);

  const airports = await listUsAirports(limit);
  console.log(`Polling ${airports.length} US airports every ${intervalSeconds}s...`);

  while (true) {
    const t0 = Date.now();
    try {
      await pollOnce(airports);
      const ms = Date.now() - t0;
      console.log(`Poll complete in ${ms}ms at ${new Date().toISOString()}`);
    } catch (err) {
      console.error("Poll loop error", err);
    }
    await sleep(intervalSeconds * 1000);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

