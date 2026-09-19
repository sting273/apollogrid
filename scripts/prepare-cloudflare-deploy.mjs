import { readFile, writeFile } from "node:fs/promises";

const databaseId = process.env.CF_D1_DATABASE_ID;
if (!databaseId) throw new Error("Set CF_D1_DATABASE_ID before preparing a Cloudflare deployment.");

const configPath = new URL("../dist/server/wrangler.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));
config.name = process.env.CF_WORKER_NAME || "apollogrid";
config.workers_dev = false;
config.triggers = { crons: ["15 1 * * *"] };
config.d1_databases = [{ binding: "DB", database_name: "apollogrid", database_id: databaseId }];
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Prepared ${config.name} for Cloudflare with its daily backup cron.`);
