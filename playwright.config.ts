import { defineConfig } from "@playwright/test";

export default defineConfig({testDir:"./e2e",use:{baseURL:"http://127.0.0.1:3000"},webServer:{command:"node node_modules/next/dist/bin/next start",url:"http://127.0.0.1:3000/api/health",reuseExistingServer:!process.env.CI,timeout:120000}});
