import "server-only";
import { z } from "zod";

const defaults = {
  DATABASE_URL:
    "postgresql://flight_seek:flight_seek@localhost:5432/flight_seek",
  REDIS_URL: "redis://localhost:6379",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NOAA_USER_AGENT: "(flight_seek, dev@localhost)",
  EUROCONTROL_PUBLIC_FEED_URL: "",
  COMM_AVIATION_API_BASE_URL: "https://api.flightqueue.com/v1",
  COMM_AVIATION_API_KEY: "",
} as const;

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  NOAA_USER_AGENT: z.string().min(1),
  EUROCONTROL_PUBLIC_FEED_URL: z.string().optional().default(""),
  COMM_AVIATION_API_BASE_URL: z.string().url(),
  COMM_AVIATION_API_KEY: z.string().optional().default(""),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const parsedServer = serverSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL ?? defaults.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL ?? defaults.REDIS_URL,
  NOAA_USER_AGENT: process.env.NOAA_USER_AGENT ?? defaults.NOAA_USER_AGENT,
  EUROCONTROL_PUBLIC_FEED_URL:
    process.env.EUROCONTROL_PUBLIC_FEED_URL ?? defaults.EUROCONTROL_PUBLIC_FEED_URL,
  COMM_AVIATION_API_BASE_URL:
    process.env.COMM_AVIATION_API_BASE_URL ?? defaults.COMM_AVIATION_API_BASE_URL,
  COMM_AVIATION_API_KEY:
    process.env.COMM_AVIATION_API_KEY ?? defaults.COMM_AVIATION_API_KEY,
});

if (!parsedServer.success) {
  console.error(
    "Invalid server environment variables:",
    parsedServer.error.flatten().fieldErrors,
  );
  throw new Error("Invalid server environment variables");
}

const parsedPublic = publicSchema.safeParse({
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ?? defaults.NEXT_PUBLIC_APP_URL,
});

if (!parsedPublic.success) {
  console.error(
    "Invalid public environment variables:",
    parsedPublic.error.flatten().fieldErrors,
  );
  throw new Error("Invalid public environment variables");
}

/** Server-only configuration. Do not import from client components. */
export const env = {
  ...parsedServer.data,
  ...parsedPublic.data,
} as const;

export type Env = typeof env;
