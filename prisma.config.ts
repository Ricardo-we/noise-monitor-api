import "dotenv/config";
import { defineConfig } from "prisma/config";
import { toPostgresConnectionString } from "./src/lib/db-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: toPostgresConnectionString(process.env.DB_URL ?? ""),
  },
});
