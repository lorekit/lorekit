import fs from "fs";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: "aws-1-us-east-2.pooler.supabase.com",
    port: 5432,
    user: "postgres.ihyawribjvzdtynqvsaj",
    password: process.env.DATABASE_PASSWORD!,
    database: "postgres",
    ssl: {
      ca: fs.readFileSync("./certs/prod-ca-2021.crt").toString(),
      rejectUnauthorized: true,
    },
  },
  entities: {
    roles: {
      provider: "supabase",
    },
  },
});
