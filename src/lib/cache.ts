import "server-only";
import { withRedis } from "@/lib/redis";

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  return withRedis(async (redis) => {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  });
}

export async function cacheSetJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  return withRedis(async (redis) => {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  });
}

