import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({test:{environment:"node",include:["src/**/*.test.ts","tests/**/*.test.ts"],coverage:{enabled:false}},resolve:{alias:{"server-only":fileURLToPath(new URL("./node_modules/next/dist/compiled/server-only/empty.js",import.meta.url)),"@":fileURLToPath(new URL("./src",import.meta.url))}}});
