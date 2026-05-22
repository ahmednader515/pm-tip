import * as fs from "fs";
import * as path from "path";

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1);
    if (!key || process.env[key] !== undefined) continue;

    process.env[key] = stripWrappingQuotes(rawValue);
  }
}

function loadLocalEnv(): void {
  loadEnvFile(path.resolve(process.cwd(), ".env"));
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
}

loadLocalEnv();

const sourceUrl =
  process.env.OLD_DIRECT_DATABASE_URL ||
  process.env.OLD_DATABASE_URL ||
  process.env.AIVEN_DATABASE_URL;
const targetUrl =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.PRISMA_DATABASE_URL;

if (!sourceUrl) {
  throw new Error(
    "Missing source DB URL. Set OLD_DIRECT_DATABASE_URL or OLD_DATABASE_URL."
  );
}

if (!targetUrl) {
  throw new Error(
    "Missing target DB URL. Set DIRECT_DATABASE_URL or DATABASE_URL."
  );
}

// Reuse the existing migration script by providing the env names it expects.
process.env.AIVEN_DATABASE_URL = sourceUrl;
process.env.PRISMA_DATABASE_URL = targetUrl;

console.log("Using source from OLD_* env vars and target from current DB env vars...");

require("./migrate-aiven-to-prisma");
