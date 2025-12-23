import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use the same environment variable that you had in the schema: `multi`
    url: env("RDP02_INS1_DATABASE_URL"),
  },
});
