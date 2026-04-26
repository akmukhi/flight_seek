import "server-only";
import { env } from "@/lib/env";

export type NoaaPointMeta = {
  forecastUrl?: string;
  forecastHourlyUrl?: string;
  observationStationsUrl?: string;
  county?: string;
  fireWeatherZone?: string;
  forecastZone?: string;
  timeZone?: string;
};

export type NoaaLatestObservation = {
  stationId?: string;
  timestamp?: string;
  textDescription?: string;
  temperatureC?: number | null;
  windSpeedKph?: number | null;
  windDirection?: string | null;
  visibilityM?: number | null;
  relativeHumidity?: number | null;
  raw?: unknown;
};

const BASE = "https://api.weather.gov";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function uaHeaders() {
  return {
    "User-Agent": env.NOAA_USER_AGENT,
    Accept: "application/geo+json, application/json",
  } as const;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function fetchNoaaPoint(lat: number, lon: number): Promise<NoaaPointMeta> {
  const url = `${BASE}/points/${lat},${lon}`;
  const res = await fetch(url, { headers: uaHeaders(), next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`NOAA points fetch failed: ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  const p = isRecord(json) && isRecord(json.properties) ? (json.properties as Record<string, unknown>) : {};
  return {
    forecastUrl: typeof p.forecast === "string" ? p.forecast : undefined,
    forecastHourlyUrl: typeof p.forecastHourly === "string" ? p.forecastHourly : undefined,
    observationStationsUrl:
      typeof p.observationStations === "string" ? p.observationStations : undefined,
    county: typeof p.county === "string" ? p.county : undefined,
    fireWeatherZone: typeof p.fireWeatherZone === "string" ? p.fireWeatherZone : undefined,
    forecastZone: typeof p.forecastZone === "string" ? p.forecastZone : undefined,
    timeZone: typeof p.timeZone === "string" ? p.timeZone : undefined,
  };
}

export async function fetchNoaaLatestObservationFromStations(
  stationsUrl: string,
): Promise<NoaaLatestObservation | null> {
  const stationsRes = await fetch(stationsUrl, { headers: uaHeaders(), next: { revalidate: 0 } });
  if (!stationsRes.ok) {
    throw new Error(`NOAA stations fetch failed: ${stationsRes.status}`);
  }
  const stationsJson = (await stationsRes.json()) as unknown;
  const features =
    isRecord(stationsJson) && Array.isArray(stationsJson.features) ? (stationsJson.features as unknown[]) : [];
  const first = features[0];
  const firstProps =
    isRecord(first) && isRecord(first.properties) ? (first.properties as Record<string, unknown>) : null;
  const firstStation = firstProps && typeof firstProps.stationIdentifier === "string"
    ? firstProps.stationIdentifier
    : null;
  if (typeof firstStation !== "string" || firstStation.length === 0) return null;

  const obsUrl = `${BASE}/stations/${encodeURIComponent(firstStation)}/observations/latest`;
  const obsRes = await fetch(obsUrl, { headers: uaHeaders(), next: { revalidate: 0 } });
  if (!obsRes.ok) {
    throw new Error(`NOAA latest obs fetch failed: ${obsRes.status}`);
  }
  const obsJson = (await obsRes.json()) as unknown;
  const p = isRecord(obsJson) && isRecord(obsJson.properties) ? (obsJson.properties as Record<string, unknown>) : {};

  return {
    stationId: firstStation,
    timestamp: typeof p.timestamp === "string" ? p.timestamp : undefined,
    textDescription: typeof p.textDescription === "string" ? p.textDescription : undefined,
    temperatureC: isRecord(p.temperature) ? num(p.temperature.value) : null,
    windSpeedKph: isRecord(p.windSpeed) ? num(p.windSpeed.value) : null,
    windDirection: isRecord(p.windDirection) ? (typeof p.windDirection.value === "number" ? String(p.windDirection.value) : null) : null,
    visibilityM: isRecord(p.visibility) ? num(p.visibility.value) : null,
    relativeHumidity: isRecord(p.relativeHumidity) ? num(p.relativeHumidity.value) : null,
    raw: obsJson,
  };
}

export async function fetchNoaaAlerts(activeZoneUrl?: string): Promise<unknown[] | null> {
  if (!activeZoneUrl) return null;
  const url = `${BASE}/alerts/active?zone=${encodeURIComponent(activeZoneUrl.split("/").pop() ?? "")}`;
  const res = await fetch(url, { headers: uaHeaders(), next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`NOAA alerts fetch failed: ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return isRecord(json) && Array.isArray(json.features) ? (json.features as unknown[]) : [];
}

