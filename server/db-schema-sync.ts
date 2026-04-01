import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";

function getAllSchemaTableObjects(): PgTable[] {
  const tables: PgTable[] = [];
  for (const val of Object.values(schema)) {
    try {
      const config = getTableConfig(val as any);
      if (config && config.name && config.columns) {
        tables.push(val as PgTable);
      }
    } catch {}
  }
  return tables;
}

function generateCreateTableDDL(table: PgTable): string {
  const config = getTableConfig(table);
  const colDefs: string[] = [];

  for (const col of config.columns) {
    const parts: string[] = [col.name];

    const sqlType = (col as any).getSQLType?.();
    if (sqlType) {
      parts.push(sqlType);
    } else {
      parts.push("text");
    }

    if (col.primary) {
      if (col.columnType === "PgSerial") {
        parts[1] = "SERIAL";
      }
      parts.push("PRIMARY KEY");
    }

    if (col.notNull && !col.primary) {
      parts.push("NOT NULL");
    }

    if (col.hasDefault && col.default !== undefined && !col.primary) {
      const def = col.default;
      if (typeof def === "string") {
        parts.push(`DEFAULT '${def.replace(/'/g, "''")}'`);
      } else if (typeof def === "number" || typeof def === "boolean") {
        parts.push(`DEFAULT ${def}`);
      }
    } else if (col.hasDefault && col.defaultFn && !col.primary) {
      if (col.columnType === "PgTimestamp") {
        parts.push("DEFAULT NOW()");
      }
    }

    if (col.isUnique) {
      parts.push("UNIQUE");
    }

    colDefs.push("  " + parts.join(" "));
  }

  return `CREATE TABLE IF NOT EXISTS "${config.name}" (\n${colDefs.join(",\n")}\n)`;
}

async function getExistingTables(): Promise<Set<string>> {
  const result = await db.execute(sql.raw(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  ));
  return new Set((result.rows as any[]).map(r => r.table_name));
}

function topologicalSort(tables: PgTable[]): PgTable[] {
  const configMap = new Map<string, { table: PgTable; deps: string[] }>();

  for (const table of tables) {
    const config = getTableConfig(table);
    const deps: string[] = [];
    for (const fk of config.foreignKeys) {
      try {
        const ref = (fk as any).reference?.();
        if (ref?.foreignTable) {
          const foreignName = getTableConfig(ref.foreignTable).name;
          if (foreignName !== config.name) {
            deps.push(foreignName);
          }
        }
      } catch {}
    }
    configMap.set(config.name, { table, deps });
  }

  const sorted: PgTable[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    if (visiting.has(name)) return;
    visiting.add(name);

    const entry = configMap.get(name);
    if (entry) {
      for (const dep of entry.deps) {
        if (configMap.has(dep)) {
          visit(dep);
        }
      }
      sorted.push(entry.table);
    }
    visiting.delete(name);
    visited.add(name);
  }

  for (const name of configMap.keys()) {
    visit(name);
  }

  return sorted;
}

export async function syncMissingTables(): Promise<{ created: string[]; errors: string[] }> {
  const created: string[] = [];
  const errors: string[] = [];

  try {
    const existing = await getExistingTables();
    const allTables = getAllSchemaTableObjects();

    const missing = allTables.filter(t => {
      const config = getTableConfig(t);
      return !existing.has(config.name);
    });

    if (missing.length === 0) {
      console.log(`[schema-sync] All ${allTables.length} tables exist ✓`);
      return { created, errors };
    }

    console.log(`[schema-sync] Found ${missing.length} missing table(s), creating...`);

    const sorted = topologicalSort(missing);

    for (const table of sorted) {
      const config = getTableConfig(table);
      try {
        const ddl = generateCreateTableDDL(table);
        await db.execute(sql.raw(ddl));
        created.push(config.name);
        console.log(`[schema-sync] ✓ Created table: ${config.name}`);
      } catch (err: any) {
        errors.push(`${config.name}: ${err.message}`);
        console.error(`[schema-sync] ✗ Failed to create table ${config.name}:`, err.message);
      }
    }

    if (created.length > 0) {
      console.log(`[schema-sync] Created ${created.length} table(s): ${created.join(", ")}`);
    }
    if (errors.length > 0) {
      console.error(`[schema-sync] ${errors.length} error(s) during sync`);
    }
  } catch (err: any) {
    console.error("[schema-sync] Fatal error:", err.message);
    errors.push(err.message);
  }

  return { created, errors };
}

export async function syncMissingColumns(): Promise<{ added: string[]; errors: string[] }> {
  const added: string[] = [];
  const columnErrors: string[] = [];

  try {
    const existing = await getExistingTables();
    const allTables = getAllSchemaTableObjects();

    const existingTables = allTables.filter(t => {
      const config = getTableConfig(t);
      return existing.has(config.name);
    });

    for (const table of existingTables) {
      const config = getTableConfig(table);
      try {
        const colResult = await db.execute(sql.raw(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${config.name}'`
        ));
        const existingCols = new Set((colResult.rows as any[]).map(r => r.column_name));

        for (const col of config.columns) {
          if (!existingCols.has(col.name)) {
            const sqlType = (col as any).getSQLType?.() || "text";
            let alterSql = `ALTER TABLE "${config.name}" ADD COLUMN "${col.name}" ${sqlType}`;

            if (col.hasDefault && col.default !== undefined) {
              const def = col.default;
              if (typeof def === "string") {
                alterSql += ` DEFAULT '${def.replace(/'/g, "''")}'`;
              } else if (typeof def === "number" || typeof def === "boolean") {
                alterSql += ` DEFAULT ${def}`;
              }
            } else if (col.hasDefault && col.defaultFn) {
              if (col.columnType === "PgTimestamp") {
                alterSql += ` DEFAULT NOW()`;
              }
            }

            try {
              await db.execute(sql.raw(alterSql));
              added.push(`${config.name}.${col.name}`);
              console.log(`[schema-sync] ✓ Added column: ${config.name}.${col.name} (${sqlType})`);
            } catch (colErr: any) {
              columnErrors.push(`${config.name}.${col.name}: ${colErr.message}`);
            }
          }
        }
      } catch (tableErr: any) {
        columnErrors.push(`${config.name}: ${tableErr.message}`);
      }
    }

    if (added.length > 0) {
      console.log(`[schema-sync] Added ${added.length} column(s)`);
    }
  } catch (err: any) {
    console.error("[schema-sync] Column sync error:", err.message);
    columnErrors.push(err.message);
  }

  return { added, errors: columnErrors };
}

export async function fullSchemaSync(): Promise<void> {
  console.log("[schema-sync] Starting full schema sync...");
  const t0 = Date.now();

  const tableResult = await syncMissingTables();
  const colResult = await syncMissingColumns();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const totalChanges = tableResult.created.length + colResult.added.length;
  const totalErrors = tableResult.errors.length + colResult.errors.length;

  if (totalChanges === 0 && totalErrors === 0) {
    console.log(`[schema-sync] Complete (${elapsed}s) — no changes needed`);
  } else {
    console.log(`[schema-sync] Complete (${elapsed}s) — ${totalChanges} change(s), ${totalErrors} error(s)`);
  }
}
