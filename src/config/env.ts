import { z } from "zod";

const DEV_SESSION_SECRET = "dev-only-insecure-secret-do-not-use-in-production";

const SCHEMA_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().positive().default(8080),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: z.string().optional(),
    PG_HOST: z.string().optional(),
    PG_USER: z.string().optional(),
    PG_PASSWORD: z.string().optional(),
    PG_PORT: z.coerce.number().int().positive().optional(),
    PG_DATABASE: z.string().optional(),
    /** Existing RDS dev schema — never used by this mock app */
    PG_SCHEMA: z.string().optional(),
    /** Isolated schema where mock app tables are created */
    PG_MOCK_SCHEMA: z
      .string()
      .default("ghri_mock")
      .refine((value) => SCHEMA_NAME_PATTERN.test(value), {
        message: "PG_MOCK_SCHEMA must be a valid PostgreSQL identifier",
      }),
    SESSION_SECRET: z.string().optional(),
    ALLOWED_ORIGINS: z.string().optional(),
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasUrl = Boolean(value.DATABASE_URL?.trim());
    const hasParts =
      value.PG_HOST &&
      value.PG_USER &&
      value.PG_PASSWORD &&
      value.PG_PORT &&
      value.PG_DATABASE;

    if (!hasUrl && !hasParts) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Set DATABASE_URL or PG_HOST, PG_USER, PG_PASSWORD, PG_PORT, and PG_DATABASE",
        path: ["DATABASE_URL"],
      });
    }

    if (
      value.PG_SCHEMA &&
      value.PG_MOCK_SCHEMA &&
      value.PG_SCHEMA.toLowerCase() === value.PG_MOCK_SCHEMA.toLowerCase()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "PG_MOCK_SCHEMA must differ from PG_SCHEMA so mock tables do not overwrite dev data",
        path: ["PG_MOCK_SCHEMA"],
      });
    }

    if (value.NODE_ENV === "production") {
      if (!value.SESSION_SECRET || value.SESSION_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "SESSION_SECRET must be at least 32 characters in production",
          path: ["SESSION_SECRET"],
        });
      }
      if (!value.ALLOWED_ORIGINS?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ALLOWED_ORIGINS is required in production",
          path: ["ALLOWED_ORIGINS"],
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${message}`);
  }

  cached = parsed.data;
  return cached;
}

export function getDatabaseUrl(env: Env = loadEnv()): string {
  if (env.DATABASE_URL?.trim()) {
    return env.DATABASE_URL.trim();
  }

  const password = encodeURIComponent(env.PG_PASSWORD!);
  return `postgresql://${env.PG_USER}:${password}@${env.PG_HOST}:${env.PG_PORT}/${env.PG_DATABASE}`;
}

export function getMockSchemaName(env: Env = loadEnv()): string {
  return env.PG_MOCK_SCHEMA;
}

export function getPgSsl(env: Env = loadEnv()): false | { rejectUnauthorized: boolean } {
  const host = env.PG_HOST ?? env.DATABASE_URL ?? "";
  if (host.includes("amazonaws.com") || host.includes("rds.")) {
    return { rejectUnauthorized: false };
  }
  return false;
}

export function isProduction(env: Env = loadEnv()): boolean {
  return env.NODE_ENV === "production";
}

export function getSessionSecret(env: Env = loadEnv()): string {
  if (env.NODE_ENV === "production") {
    return env.SESSION_SECRET!;
  }
  return env.SESSION_SECRET ?? DEV_SESSION_SECRET;
}

export function getAllowedOrigins(env: Env = loadEnv()): string[] | true {
  const raw = env.ALLOWED_ORIGINS?.trim();
  if (raw) {
    return raw.split(",").map((origin) => origin.trim()).filter(Boolean);
  }
  if (isProduction(env)) {
    return [];
  }
  return true;
}

export function getStripeConfig(env: Env = loadEnv()) {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secretKey || !webhookSecret) {
    return null;
  }

  return {
    secretKey,
    webhookSecret,
    frontendUrl: env.FRONTEND_URL,
  };
}
