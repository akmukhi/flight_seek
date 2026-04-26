import "server-only";
import { getPool } from "../../../scripts/db/db";
import type { IssueBundle, IssueEventInsert, IssueUpsert } from "@/lib/issues/types";

function nowIso() {
  return new Date().toISOString();
}

async function resolveAirportIds(iatas: string[]) {
  if (iatas.length === 0) return new Map<string, number>();
  const pool = getPool();
  const uniq = [...new Set(iatas.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const res = await pool.query<{ id: number; iata_code: string }>(
    `SELECT id, iata_code FROM airport WHERE iata_code = ANY($1::text[])`,
    [uniq],
  );
  return new Map(res.rows.map((r) => [r.iata_code.trim().toUpperCase(), r.id]));
}

async function upsertIssueRow(issue: IssueUpsert): Promise<string> {
  const pool = getPool();
  const res = await pool.query<{ id: string }>(
    `
    INSERT INTO issue(
      source, source_key, type_key, title, summary, status, severity, starts_at, ends_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, COALESCE($6, 'open'), COALESCE($7, 'info'), $8, $9, now()
    )
    ON CONFLICT (source, source_key) DO UPDATE SET
      type_key = EXCLUDED.type_key,
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      status = EXCLUDED.status,
      severity = EXCLUDED.severity,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      updated_at = now()
    RETURNING id
    `,
    [
      issue.source,
      issue.sourceKey,
      issue.typeKey,
      issue.title,
      issue.summary ?? null,
      issue.status ?? null,
      issue.severity ?? null,
      issue.startsAt ?? null,
      issue.endsAt ?? null,
    ],
  );
  return res.rows[0]!.id;
}

async function upsertIssueAirports(issueId: string, issue: IssueUpsert) {
  const pool = getPool();
  const airports = issue.airports ?? [];
  if (airports.length === 0) return;

  const iatas = airports.map((a) => a.iata);
  const idMap = await resolveAirportIds(iatas);

  for (const a of airports) {
    const iata = a.iata.trim().toUpperCase();
    const airportId = idMap.get(iata);
    if (!airportId) continue;
    await pool.query(
      `
      INSERT INTO issue_airport(issue_id, airport_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
      `,
      [issueId, airportId, a.role ?? "affected"],
    );
  }
}

async function insertEvent(issueId: string, ev: IssueEventInsert) {
  const pool = getPool();
  await pool.query(
    `
    INSERT INTO issue_event(
      issue_id, source, source_ref, kind, published_at, observed_at, effective_start, effective_end,
      headline, details, payload
    ) VALUES (
      $1, $2, $3, $4, $5, COALESCE($6, now()), $7, $8, $9, $10, $11
    )
    ON CONFLICT (source, source_ref, kind) DO NOTHING
    `,
    [
      issueId,
      ev.source,
      ev.sourceRef ?? null,
      ev.kind,
      ev.publishedAt ?? null,
      ev.observedAt ?? null,
      ev.effectiveStart ?? null,
      ev.effectiveEnd ?? null,
      ev.headline ?? null,
      ev.details ?? null,
      ev.payload ? JSON.stringify(ev.payload) : "{}",
    ],
  );
}

export async function ingestIssueBundle(bundle: IssueBundle) {
  const issueId = await upsertIssueRow(bundle.issue);
  await upsertIssueAirports(issueId, bundle.issue);

  for (const ev of bundle.events) {
    await insertEvent(issueId, {
      ...ev,
      observedAt: ev.observedAt ?? nowIso(),
    });
  }

  return issueId;
}

