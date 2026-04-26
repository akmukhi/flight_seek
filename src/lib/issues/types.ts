import "server-only";

export type IssueStatus = "open" | "resolved" | "dismissed";
export type IssueSeverity = "info" | "minor" | "major" | "critical";

export type IssueTypeKey =
  | "weather"
  | "atc"
  | "security"
  | "airport_ops"
  | "airline_ops"
  | "notam"
  | "other";

export type IssueUpsert = {
  source: string; // e.g. "eurocontrol_public", "flightqueue"
  sourceKey: string; // stable id within that source
  typeKey: IssueTypeKey;
  title: string;
  summary?: string | null;
  status?: IssueStatus;
  severity?: IssueSeverity;
  startsAt?: string | null;
  endsAt?: string | null;
  airports?: { iata: string; role?: string }[];
};

export type IssueEventInsert = {
  source: string;
  sourceRef?: string | null; // stable event ref (dedupe)
  kind: string; // e.g. "atfm_measure", "network_notice", "airport_delay"
  publishedAt?: string | null;
  observedAt?: string | null;
  effectiveStart?: string | null;
  effectiveEnd?: string | null;
  headline?: string | null;
  details?: string | null;
  payload?: unknown;
};

export type IssueBundle = {
  issue: IssueUpsert;
  events: IssueEventInsert[];
};

