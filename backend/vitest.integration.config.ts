import { defineConfig } from "vitest/config";

// Tests de integración: corren contra una base Postgres real `iuris_test` (misma instancia
// local, base aparte). El setupFile reescribe DATABASE_URL a esa base y aborta si no es *_test.
export default defineConfig({
  test: {
    pool: "threads",
    include: ["src/tests/integration/**/*.test.ts"],
    setupFiles: ["src/tests/integration/setup.ts"],
    fileParallelism: false,
  },
});
