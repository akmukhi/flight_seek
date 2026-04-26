import "server-only";
import { env } from "@/lib/env";
import type { IssueBundle } from "@/lib/issues/types";
import type { IssueSeverity, IssueStatus } from "@/lib/issues/types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * EUROCONTROL "public" ingestion.
 *
 * The public NOP is freely accessible via a web portal; machine interfaces vary by eligibility/agreements.
 * This adapter is intentionally **feed-driven**: configure `EUROCONTROL_PUBLIC_FEED_URL` to a JSON feed
 * (or a gateway endpoint) that you're approved to consume, and we normalize it into `IssueBundle`s.
 */
export async function fetchEurocontrolPublicIssues(): Promise<IssueBundle[]> {
  const url = env.EUROCONTROL_PUBLIC_FEED_URL;
  if (!url) return [];

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`EUROCONTROL public feed fetch failed: ${res.status}`);
  }
  const json = (await res.json()) as unknown;

  // Expected shape (configurable feed):
  // { items: [{ id, title, summary, severity, status, startsAt, endsAt, airports: ["CDG"], kind, payload, publishedAt }] }
  const items = isRecord(json) && Array.isArray(json.items) ? (json.items as unknown[]) : Array.isArray(json) ? json : [];

  const bundles: IssueBundle[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === "string" ? item.id : null;
    const title = typeof item.title === "string" ? item.title : null;
    if (!id || !title) continue;

    const airportsRaw =
      Array.isArray(item.airports) ? (item.airports as unknown[]) : [];
    const airports = airportsRaw
      .filter((a): a is string => typeof a === "string")
      .map((iata) => ({ iata: iata.trim().toUpperCase(), role: "affected" }));

    const kind = typeof item.kind === "string" ? item.kind : "network_notice";
    const status: IssueStatus =
      item.status === "resolved" || item.status === "dismissed" ? item.status : "open";
    const severity: IssueSeverity =
      item.severity === "minor" || item.severity === "major" || item.severity === "critical"
        ? item.severity
        : "info";
    bundles.push({
      issue: {
        source: "eurocontrol_public",
        sourceKey: id,
        typeKey: "atc",
        title,
        summary: typeof item.summary === "string" ? item.summary : null,
        status,
        severity,
        startsAt: typeof item.startsAt === "string" ? item.startsAt : null,
        endsAt: typeof item.endsAt === "string" ? item.endsAt : null,
        airports,
      },
      events: [
        {
          source: "eurocontrol_public",
          sourceRef: id,
          kind,
          publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : null,
          headline: title,
          details: typeof item.details === "string" ? item.details : null,
          payload: isRecord(item.payload) ? item.payload : item,
        },
      ],
    });
  }

  return bundles;
}

