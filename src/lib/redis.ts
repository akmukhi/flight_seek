import "server-only";
import { createClient } from "redis";
import { env } from "@/lib/env";

let client:
  | ReturnType<typeof createClient>
  | undefined;

export function getRedis() {
  if (!client) {
    client = createClient({ url: env.REDIS_URL });
    client.on("error", (err) => {
      console.error("Redis client error", err);
    });
  }
  return client;
}

export async function withRedis<T>(fn: (c: NonNullable<typeof client>) => Promise<T>) {
  const c = getRedis();
  if (!c.isOpen) {
    await c.connect();
  }
  return fn(c);
}

