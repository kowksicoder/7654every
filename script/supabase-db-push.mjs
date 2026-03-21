#!/usr/bin/env node
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILES = [".env.local", ".env"];

function parseEnvValue(raw, key) {
  const pattern = new RegExp(`^${key}=(.*)$`, "m");
  const match = raw.match(pattern);

  if (!match) {
    return null;
  }

  const [, value] = match;
  return value.replace(/^['"]|['"]$/g, "");
}

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  for (const file of ENV_FILES) {
    const absolutePath = resolve(process.cwd(), file);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const contents = readFileSync(absolutePath, "utf8");
    const databaseUrl = parseEnvValue(contents, "DATABASE_URL");

    if (databaseUrl) {
      return databaseUrl;
    }
  }

  throw new Error(
    "DATABASE_URL was not found in process.env, .env.local, or .env."
  );
}

function escapeForDoubleQuotes(value) {
  return value.replace(/(["`$\\])/g, "\\$1");
}

function getPsqlCommand() {
  return process.platform === "win32" ? "psql.exe" : "psql";
}

function getLocalMigrationVersions() {
  const migrationDirectory = resolve(process.cwd(), "supabase", "migrations");

  if (!existsSync(migrationDirectory)) {
    return [];
  }

  return readdirSync(migrationDirectory)
    .map((file) => file.match(/^(\d+)_.*\.sql$/)?.[1] ?? null)
    .filter(Boolean)
    .sort();
}

function queryPsql(databaseUrl, sql) {
  return execFileSync(getPsqlCommand(), [databaseUrl, "-At", "-c", sql], {
    cwd: process.cwd(),
    encoding: "utf8"
  }).trim();
}

function getAppliedMigrationVersions(databaseUrl) {
  const migrationTable = queryPsql(
    databaseUrl,
    "select to_regclass('supabase_migrations.schema_migrations');"
  );

  if (migrationTable !== "supabase_migrations.schema_migrations") {
    return [];
  }

  const output = queryPsql(
    databaseUrl,
    "select version from supabase_migrations.schema_migrations order by version;"
  );

  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

const databaseUrl = getDatabaseUrl();
const escapedDatabaseUrl = escapeForDoubleQuotes(databaseUrl);
const localVersions = getLocalMigrationVersions();
const appliedVersions = new Set(getAppliedMigrationVersions(databaseUrl));
const pendingVersions = localVersions.filter(
  (version) => !appliedVersions.has(version)
);

if (pendingVersions.length === 0) {
  console.log("Supabase migrations are already up to date.");
  process.exit(0);
}

console.log(
  "Applying Supabase migrations to the configured remote database..."
);
console.log(`Pending migrations: ${pendingVersions.join(", ")}`);

execSync(
  `pnpm dlx supabase db push --workdir . --db-url "${escapedDatabaseUrl}" --include-all --yes`,
  {
    cwd: process.cwd(),
    stdio: "inherit"
  }
);

console.log("Supabase migrations are up to date.");
