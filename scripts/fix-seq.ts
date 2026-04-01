import { bootstrapConfig, getConfig } from '../server/config-bootstrap';
import pg from 'pg';

async function main() {
  await bootstrapConfig();
  const prodUrl = getConfig('DB_PROD_URL');
  if (!prodUrl) { console.log('No DB_PROD_URL'); return; }
  
  const pool = new pg.Pool({ connectionString: prodUrl, max: 1, connectionTimeoutMillis: 60000, statement_timeout: 300000 });

  const targetTables = [
    { table: 'attendance_records', col: 'id', seq: 'attendance_records_id_seq' },
    { table: 'employees', col: 'id', seq: 'employees_id_seq' },
    { table: 'users', col: 'id', seq: 'users_id_seq' },
    { table: 'companies', col: 'id', seq: 'companies_id_seq' },
    { table: 'journal_entries', col: 'id', seq: 'journal_entries_id_seq' },
    { table: 'journal_lines', col: 'id', seq: 'journal_lines_id_seq' },
    { table: 'contacts', col: 'id', seq: 'contacts_id_seq' },
    { table: 'invoices', col: 'id', seq: 'invoices_id_seq' },
    { table: 'products', col: 'id', seq: 'products_id_seq' },
    { table: 'payroll_records', col: 'id', seq: 'payroll_records_id_seq' },
    { table: 'accounts', col: 'id', seq: 'accounts_id_seq' },
    { table: 'firm_clients', col: 'id', seq: 'firm_clients_id_seq' },
    { table: 'ot_records', col: 'id', seq: 'ot_records_id_seq' },
    { table: 'leave_requests', col: 'id', seq: 'leave_requests_id_seq' },
  ];

  let fixed = 0;
  for (const t of targetTables) {
    try {
      const maxR = await pool.query(`SELECT COALESCE(MAX("${t.col}"), 0)::bigint AS max_id FROM "${t.table}"`);
      const seqR = await pool.query(`SELECT last_value, is_called FROM "${t.seq}"`);
      const maxId = Number(maxR.rows[0].max_id);
      const seqVal = Number(seqR.rows[0].last_value);
      if (maxId > seqVal || (maxId > 0 && !seqR.rows[0].is_called)) {
        const newVal = maxId + 1;
        await pool.query(`SELECT setval('"${t.seq}"', ${newVal}, true)`);
        console.log(`FIXED ${t.table}: ${seqVal} -> ${newVal}`);
        fixed++;
      } else {
        console.log(`OK ${t.table}: seq=${seqVal} max=${maxId}`);
      }
    } catch (e: any) { console.log(`SKIP ${t.table}: ${e.message?.slice(0,60)}`); }
  }
  console.log('Total fixed:', fixed);
  await pool.end();
}
main().catch(e => console.error('FATAL:', e.message));
