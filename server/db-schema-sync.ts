import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { ecomDb, isEcomSeparateDb } from "./ecom-db";
import { posDb, isPosSeparateDb } from "./pos-db";
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

const ECOM_TABLE_NAMES = new Set([
  'ecommerce_connections', 'ecommerce_orders', 'ecommerce_order_items',
  'ecommerce_product_mappings', 'ecommerce_settlements', 'ecommerce_settlement_items',
  'ecommerce_returns', 'ecommerce_return_items', 'sync_logs', 'oauth_states',
  'facebook_chat_orders', 'facebook_pages', 'chat_order_keywords', 'chat_orders',
  'platform_chat_threads', 'stock_sync_logs', 'archive_ecommerce_orders',
  'shop_stat_sync_logs', 'vat_product_dictionary',
  'live_sessions', 'live_session_products', 'live_session_orders', 'live_session_comments',
  'lucky_draw_sessions', 'lucky_draw_participants', 'lucky_draw_winners',
  'ad_budgets', 'ad_campaigns',
]);

function getEcomSchemaTableObjects(): PgTable[] {
  const tables: PgTable[] = [];
  for (const val of Object.values(schema)) {
    try {
      const config = getTableConfig(val as any);
      if (config && config.name && ECOM_TABLE_NAMES.has(config.name)) {
        tables.push(val as PgTable);
      }
    } catch {}
  }
  return tables;
}

async function syncEcomSchema(): Promise<void> {
  if (!isEcomSeparateDb()) {
    console.log("[ecom-schema-sync] Same DB — skipping (tables already synced by main sync)");
    return;
  }

  console.log("[ecom-schema-sync] Separate DB detected — syncing ecommerce tables...");
  const t0 = Date.now();
  let created = 0;
  let added = 0;
  let errors = 0;

  try {
    const existingResult = await ecomDb.execute(sql.raw(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    ));
    const existing = new Set((existingResult.rows as any[]).map(r => r.table_name));
    const ecomTables = getEcomSchemaTableObjects();

    const missing = ecomTables.filter(t => !existing.has(getTableConfig(t).name));
    if (missing.length > 0) {
      const sorted = topologicalSort(missing);
      for (const table of sorted) {
        const config = getTableConfig(table);
        try {
          const ddl = generateCreateTableDDL(table);
          await ecomDb.execute(sql.raw(ddl));
          created++;
          console.log(`[ecom-schema-sync] ✓ Created table: ${config.name}`);
        } catch (err: any) {
          if (!err.message.includes('already exists')) {
            errors++;
            console.error(`[ecom-schema-sync] ✗ Failed: ${config.name}: ${err.message}`);
          }
        }
      }
    }

    for (const table of ecomTables) {
      const config = getTableConfig(table);
      if (!existing.has(config.name)) continue;
      try {
        const colResult = await ecomDb.execute(sql.raw(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${config.name}'`
        ));
        const existingCols = new Set((colResult.rows as any[]).map(r => r.column_name));
        for (const col of config.columns) {
          if (!existingCols.has(col.name)) {
            const sqlType = (col as any).getSQLType?.() || "text";
            let alterSql = `ALTER TABLE "${config.name}" ADD COLUMN "${col.name}" ${sqlType}`;
            if (col.hasDefault && col.default !== undefined) {
              const def = col.default;
              if (typeof def === "string") alterSql += ` DEFAULT '${def.replace(/'/g, "''")}'`;
              else if (typeof def === "number" || typeof def === "boolean") alterSql += ` DEFAULT ${def}`;
            } else if (col.hasDefault && col.defaultFn && col.columnType === "PgTimestamp") {
              alterSql += ` DEFAULT NOW()`;
            }
            try {
              await ecomDb.execute(sql.raw(alterSql));
              added++;
              console.log(`[ecom-schema-sync] ✓ Added column: ${config.name}.${col.name}`);
            } catch {}
          }
        }
      } catch {}
    }
  } catch (err: any) {
    console.error("[ecom-schema-sync] Fatal error:", err.message);
    errors++;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[ecom-schema-sync] Complete (${elapsed}s) — ${created} tables, ${added} columns, ${errors} errors`);
}

const POS_TABLE_NAMES = new Set([
  'pos_sessions', 'pos_transactions', 'pos_transaction_items',
  'restaurant_areas', 'restaurant_tables', 'restaurant_orders', 'restaurant_order_items',
  'menu_categories', 'menu_items', 'menu_modifier_groups', 'menu_modifier_options',
  'menu_item_modifiers', 'kitchen_tickets',
]);

function getPosSchemaTableObjects(): PgTable[] {
  const tables: PgTable[] = [];
  for (const val of Object.values(schema)) {
    try {
      const config = getTableConfig(val as any);
      if (config && config.name && POS_TABLE_NAMES.has(config.name)) {
        tables.push(val as PgTable);
      }
    } catch {}
  }
  return tables;
}

async function syncPosSchema(): Promise<void> {
  if (!isPosSeparateDb()) {
    console.log("[pos-schema-sync] Same DB — skipping (tables already synced by main sync)");
    return;
  }

  console.log("[pos-schema-sync] Separate DB detected — syncing POS tables...");
  const t0 = Date.now();
  let created = 0;
  let added = 0;
  let errors = 0;

  try {
    const existingResult = await posDb.execute(sql.raw(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    ));
    const existing = new Set((existingResult.rows as any[]).map(r => r.table_name));
    const posTables = getPosSchemaTableObjects();

    const missing = posTables.filter(t => !existing.has(getTableConfig(t).name));
    if (missing.length > 0) {
      const sorted = topologicalSort(missing);
      for (const table of sorted) {
        const config = getTableConfig(table);
        try {
          const ddl = generateCreateTableDDL(table);
          await posDb.execute(sql.raw(ddl));
          created++;
          console.log(`[pos-schema-sync] ✓ Created table: ${config.name}`);
        } catch (err: any) {
          if (!err.message.includes('already exists')) {
            errors++;
            console.error(`[pos-schema-sync] ✗ Failed: ${config.name}: ${err.message}`);
          }
        }
      }
    }

    for (const table of posTables) {
      const config = getTableConfig(table);
      if (!existing.has(config.name)) continue;
      try {
        const colResult = await posDb.execute(sql.raw(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${config.name}'`
        ));
        const existingCols = new Set((colResult.rows as any[]).map(r => r.column_name));
        for (const col of config.columns) {
          if (!existingCols.has(col.name)) {
            const sqlType = (col as any).getSQLType?.() || "text";
            let alterSql = `ALTER TABLE "${config.name}" ADD COLUMN "${col.name}" ${sqlType}`;
            if (col.hasDefault && col.default !== undefined) {
              const def = col.default;
              if (typeof def === "string") alterSql += ` DEFAULT '${def.replace(/'/g, "''")}'`;
              else if (typeof def === "number" || typeof def === "boolean") alterSql += ` DEFAULT ${def}`;
            } else if (col.hasDefault && col.defaultFn && col.columnType === "PgTimestamp") {
              alterSql += ` DEFAULT NOW()`;
            }
            try {
              await posDb.execute(sql.raw(alterSql));
              added++;
              console.log(`[pos-schema-sync] ✓ Added column: ${config.name}.${col.name}`);
            } catch {}
          }
        }
      } catch {}
    }
  } catch (err: any) {
    console.error("[pos-schema-sync] Fatal error:", err.message);
    errors++;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[pos-schema-sync] Complete (${elapsed}s) — ${created} tables, ${added} columns, ${errors} errors`);
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

  await syncEcomSchema();
  await syncPosSchema();
}
