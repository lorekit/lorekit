import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Supabase manages its own roles (anon, authenticated, service_role, etc.)
  // This prevents drizzle-kit from trying to create/drop them.
  entities: {
    roles: {
      provider: "supabase",
    },
  },
});
