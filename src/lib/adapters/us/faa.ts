import "server-only";
import { XMLParser } from "fast-xml-parser";

const NASSTATUS_URL = "https://nasstatus.faa.gov/api/airport-status-information";

export type FaaNasStatusDelay = {
  airport: string; // 3-letter airport code (typically IATA)
  reason?: string;
  type: "Arrival" | "Departure" | "Unknown";
  min?: string;
  max?: string;
  trend?: string;
};

export type FaaNasStatusSnapshot = {
  updatedAt?: string;
  delays: FaaNasStatusDelay[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
});

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function fetchFaaNasStatus(): Promise<FaaNasStatusSnapshot> {
  const res = await fetch(NASSTATUS_URL, {
    headers: {
      Accept: "application/xml",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`FAA NASSTATUS fetch failed: ${res.status}`);
  }
  const xml = await res.text();
  const parsed = parser.parse(xml) as unknown;

  const root = isRecord(parsed) && isRecord(parsed.AIRPORT_STATUS_INFORMATION)
    ? (parsed.AIRPORT_STATUS_INFORMATION as Record<string, unknown>)
    : isRecord(parsed)
      ? parsed
      : {};
  const updatedAt = typeof root.Update_Time === "string" ? root.Update_Time : undefined;

  const delayTypes = asArray(root.Delay_type) as unknown[];
  const delays: FaaNasStatusDelay[] = [];

  for (const dt of delayTypes) {
    if (!isRecord(dt)) continue;
    const list = isRecord(dt.Arrival_Departure_Delay_List)
      ? (dt.Arrival_Departure_Delay_List as Record<string, unknown>)
      : null;
    const items = asArray(list?.Delay) as unknown[];
    for (const item of items) {
      if (!isRecord(item)) continue;
      const airport = item.ARPT;
      if (!airport) continue;
      const ad = isRecord(item.Arrival_Departure)
        ? (item.Arrival_Departure as Record<string, unknown>)
        : null;
      const adType = ad && typeof ad.Type === "string" ? ad.Type : undefined;
      const type: FaaNasStatusDelay["type"] =
        adType === "Arrival" || adType === "Departure" ? adType : "Unknown";

      delays.push({
        airport: String(airport).toUpperCase(),
        reason: item.Reason ? String(item.Reason) : undefined,
        type,
        min: ad && ad.Min ? String(ad.Min) : undefined,
        max: ad && ad.Max ? String(ad.Max) : undefined,
        trend: ad && ad.Trend ? String(ad.Trend) : undefined,
      });
    }
  }

  return { updatedAt, delays };
}

