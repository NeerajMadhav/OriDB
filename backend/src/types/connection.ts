import { z } from "zod";

export const engineSchema = z.enum([
  "postgresql",
  "mysql",
  "mariadb",
  "sqlite",
  "mongodb",
  "redis",
  "cockroachdb",
  "planetscale",
  "neon",
  "supabase",
]);

export type Engine = z.infer<typeof engineSchema>;

export const environmentTagSchema = z.enum([
  "development",
  "staging",
  "production",
]);

export const connectionConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  engine: engineSchema,
  host: z.string().optional(),
  port: z.coerce.number().int().positive().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  connectionUrl: z.string().optional(),
  ssl: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  environment: environmentTagSchema.optional(),
  notes: z.string().optional(),
  connectionTimeoutSec: z.number().min(1).max(300).optional(),
  queryTimeoutSec: z.number().min(1).max(3600).optional(),
  poolMin: z.number().int().min(0).max(50).optional(),
  poolMax: z.number().int().min(1).max(100).optional(),
});

export type ConnectionConfig = z.infer<typeof connectionConfigSchema>;

export function defaultPortForEngine(engine: Engine): number {
  switch (engine) {
    case "postgresql":
    case "cockroachdb":
    case "neon":
    case "supabase":
      return 5432;
    case "mysql":
    case "mariadb":
    case "planetscale":
      return 3306;
    case "mongodb":
      return 27017;
    case "redis":
      return 6379;
    case "sqlite":
      return 0;
    default: {
      const _exhaustive: never = engine;
      return _exhaustive;
    }
  }
}
