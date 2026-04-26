import "server-only";
import { env } from "@/lib/env";
import type { IssueBundle, IssueSeverity, IssueStatus } from "@/lib/issues/types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Commercial global aviation API adapter (default shape matches FlightQueue docs).
 *
 * - Base: `COMM_AVIATION_API_BASE_URL` (default `https://api.flightqueue.com/v1`)
 * - Auth: `Authorization: Bearer ${COMM_AVIATION_API_KEY}`
 */
export async function fetchCommercialAirportIssues(iata3: string): Promise<IssueBundle[]> {
  const apiKey = env.COMM_AVIATION_API_KEY;
  if (!apiKey) return [];

  const ap = iata3.trim().toUpperCase();
  const url = `${env.COMM_AVIATION_API_BASE_URL.replace(/\/$/, "")}/airports/${encodeURIComponent(ap)}/delays`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`Commercial API fetch failed (${ap}): ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  if (!isRecord(json)) return [];

  const timestamp = asString(json.timestamp) ?? new Date().toISOString();
  const status = asString(json.status) ?? "unknown";
  const programs = Array.isArray(json.programs) ? (json.programs as unknown[]) : [];

  const bundles: IssueBundle[] = [];
  for (const p of programs) {
    if (!isRecord(p)) continue;

    const programType = asString(p.type) ?? "program";
    const reason = asString(p.reason) ?? null;
    const startTime = asString(p.start_time) ?? null;

    const sourceKey = `${ap}:${programType}:${startTime ?? timestamp}:${reason ?? "unknown"}`;
    const severity: IssueSeverity = status === "delays" ? "minor" : "info";
    const issueStatus: IssueStatus = "open";

    const title = `Delay program: ${programType}${reason ? ` (${reason})` : ""}`;
    bundles.push({
      issue: {
        source: "commercial",
        sourceKey,
        typeKey: reason === "weather" ? "weather" : "atc",
        title,
        summary: `Commercial snapshot status=${status}`,
        status: issueStatus,
        severity,
        startsAt: startTime,
        airports: [{ iata: ap, role: "affected" }],
      },
      events: [
        {
          source: "commercial",
          sourceRef: sourceKey,
          kind: "airport_delay_program",
          publishedAt: timestamp,
          headline: title,
          details: null,
          payload: p,
        },
      ],
    });
  }

  return bundles;
}

