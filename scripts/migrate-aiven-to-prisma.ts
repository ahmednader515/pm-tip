/**
 * Database Migration Script: legacy PostgreSQL -> Prisma PostgreSQL
 *
 * This migrates every table/column that exists in both source and target DBs,
 * while preserving relationships using a dependency-aware table order.
 *
 * Requirements:
 * - Set AIVEN_DATABASE_URL (or OLD_* wrapper env vars via migrate-old-db script)
 * - Set PRISMA_DATABASE_URL for the target database
 *
 * Usage:
 *   npm run migrate:aiven
 */

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const sourceDatabaseUrl = process.env.AIVEN_DATABASE_URL;
const targetDatabaseUrl = process.env.PRISMA_DATABASE_URL;

if (!sourceDatabaseUrl) {
  throw new Error("AIVEN_DATABASE_URL is not set in environment variables");
}

if (!targetDatabaseUrl) {
  throw new Error("PRISMA_DATABASE_URL is not set in environment variables");
}

const AIVEN_DATABASE_URL: string = sourceDatabaseUrl;
const PRISMA_DATABASE_URL: string = targetDatabaseUrl;

const sourceClient = new PrismaClient({
  datasources: { db: { url: AIVEN_DATABASE_URL } },
});

const targetClient = new PrismaClient({
  datasources: { db: { url: PRISMA_DATABASE_URL } },
});

const preferredTableOrder = [
  "User",
  "FawaterakPendingInvoice",
  "Course",
  "Attachment",
  "Chapter",
  "ChapterAttachment",
  "UserProgress",
  "Subscription",
  "SubscriptionCourse",
  "SubscriptionPurchase",
  "PurchaseCode",
  "Purchase",
  "BalanceTransaction",
  "Quiz",
  "QuizDraft",
  "Question",
  "QuizResult",
  "QuizAnswer",
] as const;

interface TableStats {
  tableName: string;
  rowCount: number;
}

type DbRow = Record<string, unknown>;
interface ColumnInfo {
  name: string;
  dataType: string;
  udtName: string;
}
interface ConstraintInfo {
  type: "p" | "u";
  columns: string[];
}

const MIGRATION_MODE = (process.env.MIGRATION_MODE ?? "REPLACE")
  .trim()
  .toUpperCase();
const SHOULD_REPLACE_TARGET = MIGRATION_MODE === "REPLACE";

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function quoteQualifiedTable(tableName: string): string {
  return `"public".${quoteIdentifier(tableName)}`;
}

async function getPublicTables(client: PrismaClient): Promise<string[]> {
  const rows = await client.$queryRawUnsafe<Array<{ table_name: string }>>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
  );
  return rows.map((row) => row.table_name);
}

async function getTableColumns(
  client: PrismaClient,
  tableName: string
): Promise<ColumnInfo[]> {
  const rows = await client.$queryRawUnsafe<
    Array<{ column_name: string; data_type: string; udt_name: string }>
  >(
    `
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `,
    tableName
  );
  return rows.map((row) => ({
    name: row.column_name,
    dataType: row.data_type,
    udtName: row.udt_name,
  }));
}

async function getPrimaryKeyColumns(
  client: PrismaClient,
  tableName: string
): Promise<string[]> {
  const rows = await client.$queryRawUnsafe<Array<{ column_name: string }>>(
    `
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
      WHERE n.nspname = 'public'
        AND c.relname = $1
        AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)
    `,
    tableName
  );
  return rows.map((row) => row.column_name);
}

async function getUniqueConstraints(
  client: PrismaClient,
  tableName: string
): Promise<ConstraintInfo[]> {
  const rows = await client.$queryRawUnsafe<
    Array<{ is_primary: boolean; columns: string[] }>
  >(
    `
      SELECT
        i.indisprimary AS is_primary,
        ARRAY(
          SELECT a.attname
          FROM unnest(i.indkey) WITH ORDINALITY AS ik(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ik.attnum
          ORDER BY ik.ordinality
        ) AS columns
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = $1
        AND i.indisunique = true
        AND i.indisvalid = true
        AND i.indpred IS NULL
    `,
    tableName
  );

  return rows
    .filter((row) => Array.isArray(row.columns) && row.columns.length > 0)
    .map((row) => ({
      type: row.is_primary ? "p" : "u",
      columns: row.columns,
    }));
}

async function countRowsInTable(
  client: PrismaClient,
  tableName: string
): Promise<number> {
  const result = await client.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) AS count FROM ${quoteQualifiedTable(tableName)}`
  );
  return Number(result[0]?.count ?? BigInt(0));
}

async function getAllTableCounts(
  client: PrismaClient,
  tables: string[],
  label: string
): Promise<TableStats[]> {
  console.log(`\n📊 Counting rows in ${label} database...\n`);
  const stats: TableStats[] = [];

  for (const tableName of tables) {
    try {
      const rowCount = await countRowsInTable(client, tableName);
      stats.push({ tableName, rowCount });
      console.log(
        `  ${tableName.padEnd(30)} ${rowCount.toString().padStart(10)} rows`
      );
    } catch (error) {
      console.log(`  ${tableName.padEnd(30)} ${"SKIPPED".padStart(10)}`);
      console.error(`    -> Failed to count ${tableName}:`, error);
    }
  }

  const totalRows = stats.reduce((sum, stat) => sum + stat.rowCount, 0);
  console.log(`\n  ${"TOTAL".padEnd(30)} ${totalRows.toString().padStart(10)} rows\n`);

  return stats;
}

async function ensurePrismaSchema(): Promise<void> {
  try {
    await targetClient.$queryRawUnsafe(`SELECT 1 FROM "public"."User" LIMIT 1`);
    return;
  } catch (error: any) {
    if (error.code !== "P2021" && !error.message?.includes("does not exist")) {
      throw error;
    }

    console.log("  ⚠️  Schema not found. Creating schema from schema.prisma...\n");
    const originalDatabaseUrl = process.env.DATABASE_URL;

    try {
      process.env.DATABASE_URL = PRISMA_DATABASE_URL;
      console.log("  🔄 Running: npx prisma db push --skip-generate\n");
      execSync("npx prisma db push --skip-generate --accept-data-loss", {
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: PRISMA_DATABASE_URL },
      });
      console.log("\n  ✅ Schema created successfully!\n");
    } catch {
      console.error("\n  ❌ Failed to create schema automatically.\n");
      console.error("   Please run manually:");
      console.error(
        `   $env:DATABASE_URL="${PRISMA_DATABASE_URL}"; npx prisma db push`
      );
      throw new Error(
        "Failed to create Prisma database schema. Run 'npx prisma db push' with DATABASE_URL set to PRISMA_DATABASE_URL."
      );
    } finally {
      if (originalDatabaseUrl) {
        process.env.DATABASE_URL = originalDatabaseUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
    }
  }
}

async function clearTargetTables(tableNames: string[]): Promise<void> {
  if (tableNames.length === 0) return;

  const tableListSql = tableNames.map(quoteQualifiedTable).join(", ");
  console.log("🧹 Clearing target tables for full replace sync...");
  await targetClient.$executeRawUnsafe(`TRUNCATE TABLE ${tableListSql} CASCADE`);
  console.log("  ✅ Target tables cleared\n");
}

function buildUpsertStatement(
  tableName: string,
  columns: ColumnInfo[],
  conflictColumns: string[],
  immutableColumns: string[]
): string {
  const tableSql = quoteQualifiedTable(tableName);
  const columnSql = columns.map((column) => quoteIdentifier(column.name)).join(", ");
  const placeholdersSql = columns
    .map((column, index) => {
      const placeholder = `$${index + 1}`;
      if (column.udtName === "json" || column.udtName === "jsonb") {
        return `${placeholder}::${column.udtName}`;
      }
      return placeholder;
    })
    .join(", ");
  const conflictSql = conflictColumns.map(quoteIdentifier).join(", ");

  const updateColumns = columns
    .map((column) => column.name)
    .filter(
      (column) =>
        !conflictColumns.includes(column) && !immutableColumns.includes(column)
    );

  const updateSql =
    updateColumns.length === 0
      ? "DO NOTHING"
      : `DO UPDATE SET ${updateColumns
          .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
          .join(", ")}`;

  return `
    INSERT INTO ${tableSql} (${columnSql})
    VALUES (${placeholdersSql})
    ON CONFLICT (${conflictSql}) ${updateSql}
  `;
}

async function migrateSingleTable(tableName: string): Promise<void> {
  const sourceColumns = await getTableColumns(sourceClient, tableName);
  const targetColumns = await getTableColumns(targetClient, tableName);
  const sourceColumnNames = new Set(sourceColumns.map((column) => column.name));
  const commonColumns = targetColumns.filter((column) =>
    sourceColumnNames.has(column.name)
  );

  if (commonColumns.length === 0) {
    console.log(`  ⚠️  Skipping ${tableName}: no common columns`);
    return;
  }

  const primaryKeyColumns = await getPrimaryKeyColumns(targetClient, tableName);
  const usablePrimaryKeyColumns = primaryKeyColumns.filter((column) =>
    commonColumns.some((commonColumn) => commonColumn.name === column)
  );
  const uniqueConstraints = await getUniqueConstraints(targetClient, tableName);
  const usableConstraints = uniqueConstraints.filter((constraint) =>
    constraint.columns.every((column) =>
      commonColumns.some((commonColumn) => commonColumn.name === column)
    )
  );

  if (usableConstraints.length === 0) {
    console.log(`  ⚠️  Skipping ${tableName}: no usable unique constraints`);
    return;
  }

  const preferredConflict = usableConstraints.sort((a, b) => {
    const score = (constraint: ConstraintInfo): number => {
      const includesId = constraint.columns.includes("id");
      if (constraint.type === "p") return 0;
      if (constraint.type === "u" && includesId) return 1;
      if (constraint.type === "u" && !includesId) return 2;
      return 3;
    };

    const scoreDiff = score(a) - score(b);
    if (scoreDiff !== 0) return scoreDiff;
    return a.columns.length - b.columns.length;
  })[0];

  const conflictColumns = preferredConflict.columns;
  const immutableColumns = usablePrimaryKeyColumns;
  console.log(`  ↳ Using conflict key: (${conflictColumns.join(", ")})`);

  const selectSql = `
    SELECT ${commonColumns.map((column) => quoteIdentifier(column.name)).join(", ")}
    FROM ${quoteQualifiedTable(tableName)}
  `;

  const sourceRows = await sourceClient.$queryRawUnsafe<DbRow[]>(selectSql);
  if (sourceRows.length === 0) {
    console.log(`  ✅ ${tableName}: 0 rows`);
    return;
  }

  const upsertSql = buildUpsertStatement(
    tableName,
    commonColumns,
    conflictColumns,
    immutableColumns
  );
  const batches = chunkArray(sourceRows, 100);
  let processed = 0;

  for (const batch of batches) {
    await Promise.all(
      batch.map((row) => {
        const values = commonColumns.map((column) => {
          const value = row[column.name];
          if (value === undefined || value === null) {
            return null;
          }
          if (
            (column.udtName === "json" || column.udtName === "jsonb") &&
            typeof value !== "string"
          ) {
            return JSON.stringify(value);
          }
          return value;
        });
        return targetClient.$executeRawUnsafe(upsertSql, ...values);
      })
    );

    processed += batch.length;
    if (processed % 500 === 0 || processed === sourceRows.length) {
      console.log(`    ... ${processed}/${sourceRows.length}`);
    }
  }

  console.log(
    `  ✅ ${tableName}: migrated ${sourceRows.length} rows (${commonColumns.length} columns)`
  );
}

function maskDbUrl(url: string): string {
  return url.replace(/:[^:@]+@/, ":****@");
}

async function migrate(): Promise<void> {
  try {
    console.log("🚀 Starting database migration from source -> target PostgreSQL\n");
    console.log(`📡 Source DB: ${maskDbUrl(AIVEN_DATABASE_URL)}`);
    console.log(`📡 Target DB: ${maskDbUrl(PRISMA_DATABASE_URL)}\n`);

    console.log("🔌 Testing connections...");
    await sourceClient.$connect();
    await targetClient.$connect();
    console.log("  ✅ Both connections successful\n");

    console.log("🔍 Checking target database schema...");
    await ensurePrismaSchema();
    console.log("  ✅ Schema ready\n");

    const sourceTables = await getPublicTables(sourceClient);
    const targetTables = await getPublicTables(targetClient);
    const sourceSet = new Set(sourceTables);
    const targetSet = new Set(targetTables);

    const commonTables = targetTables.filter((table) => sourceSet.has(table));
    const preferred = preferredTableOrder.filter(
      (table) => sourceSet.has(table) && targetSet.has(table)
    );
    const remaining = commonTables
      .filter((table) => !preferred.includes(table as (typeof preferredTableOrder)[number]))
      .sort((a, b) => a.localeCompare(b));
    const migrationTables = [...preferred, ...remaining];

    if (migrationTables.length === 0) {
      throw new Error("No common tables found between source and target databases.");
    }

    const sourceOnly = sourceTables.filter((table) => !targetSet.has(table));
    const targetOnly = targetTables.filter((table) => !sourceSet.has(table));

    console.log(`📦 Common tables to migrate: ${migrationTables.length}`);
    if (sourceOnly.length > 0) {
      console.log(
        `ℹ️  Source-only tables (not migrated): ${sourceOnly.join(", ")}`
      );
    }
    if (targetOnly.length > 0) {
      console.log(
        `ℹ️  Target-only tables (left as defaults): ${targetOnly.join(", ")}`
      );
    }

    const beforeStats = await getAllTableCounts(
      sourceClient,
      migrationTables,
      "source"
    );

    if (SHOULD_REPLACE_TARGET) {
      await clearTargetTables(migrationTables);
    } else {
      console.log(
        "ℹ️  MIGRATION_MODE is not REPLACE, running upsert-only without clearing target.\n"
      );
    }

    console.log("⚠️  Ready to migrate data using row-level upserts.\n");
    for (const tableName of migrationTables) {
      console.log(`🔄 Migrating ${tableName}...`);
      await migrateSingleTable(tableName);
    }

    console.log("\n✅ Migration completed successfully!\n");
    console.log("📊 Verifying migrated data in target database...\n");

    for (const stat of beforeStats) {
      const targetCount = await countRowsInTable(targetClient, stat.tableName);
      const marker = targetCount === stat.rowCount ? "✅" : "⚠️";
      console.log(
        `  ${marker} ${stat.tableName.padEnd(30)} Source: ${stat.rowCount
          .toString()
          .padStart(6)} -> Target: ${targetCount.toString().padStart(6)}`
      );
    }

    console.log("\n🎉 All done!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    await sourceClient.$disconnect();
    await targetClient.$disconnect();
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
