import { z } from "zod";

// ✅ Define a schema for all required environment variables
const EnvSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(10, "JWT_ACCESS_SECRET must be at least 10 characters"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("3000"),
});

// ✅ Validate at startup
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  process.exit(1); // Stop immediately — prevents unsafe startup
}

// ✅ Export a safe, typed object
export const ENV = parsed.data;
