import "server-only";

const BASE = "https://apps.tsa.dhs.gov/MyTSAWebService/GetConfirmedWaitTimes.ashx";

export type MyTsaWaitTimeRow = {
  airport_code: string;
  airport_name?: string;
  checkpoint_name?: string;
  wait_time?: string;
  wait_time_minutes?: number | null;
  created?: string;
};

type MyTsaRawRow = Record<string, unknown>;

function toNumberMinutes(waitTime: unknown): number | null {
  if (typeof waitTime !== "string") return null;
  // Examples: "0-15 min", "15-30 min", "30-45 min", "45+ min", "Unknown"
  const m = waitTime.match(/(\d+)\s*[-+]\s*(\d+)?/);
  if (!m) return null;
  const a = Number.parseInt(m[1] ?? "", 10);
  const b = m[2] ? Number.parseInt(m[2], 10) : null;
  if (!Number.isFinite(a)) return null;
  if (b !== null && Number.isFinite(b)) return Math.round((a + b) / 2);
  return a;
}

export async function fetchMyTsaWaitTimes(iata3: string): Promise<MyTsaWaitTimeRow[]> {
  const ap = iata3.trim().toUpperCase();
  const url = `${BASE}?ap=${encodeURIComponent(ap)}&output=json`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`MyTSA fetch failed for ${ap}: ${res.status}`);
  }
  const json = (await res.json()) as unknown;

  const rows: MyTsaRawRow[] = Array.isArray(json)
    ? (json as MyTsaRawRow[])
    : typeof json === "object" &&
        json !== null &&
        Array.isArray((json as Record<string, unknown>).WaitTimes)
      ? ((json as Record<string, unknown>).WaitTimes as MyTsaRawRow[])
      : [];
  return rows.map((r) => {
    const wait_time = typeof r.WaitTime === "string" ? r.WaitTime : undefined;
    return {
      airport_code: ap,
      airport_name: typeof r.AirportName === "string" ? r.AirportName : undefined,
      checkpoint_name: typeof r.CheckpointName === "string" ? r.CheckpointName : undefined,
      wait_time,
      wait_time_minutes: toNumberMinutes(wait_time),
      created: typeof r.Created_Datetime === "string" ? r.Created_Datetime : undefined,
    };
  });
}

