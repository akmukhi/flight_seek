import { NextResponse } from "next/server";
import { cacheGetJson } from "@/lib/cache";

export const runtime = "nodejs";

function key(parts: string[]) {
  return ["cache", "us", ...parts].join(":");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ iata: string }> },
) {
  const { iata } = await params;
  const code = iata.trim().toUpperCase();

  const snapshot = await cacheGetJson<unknown>(
    key(["snapshot", "airport", code]),
  );

  if (!snapshot) {
    return NextResponse.json(
      { error: "not_cached", airport: code },
      { status: 404 },
    );
  }

  return NextResponse.json(snapshot);
}

