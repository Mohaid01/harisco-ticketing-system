import path from 'path';
import sqlite3 from 'sqlite3';

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'database.sqlite');
const TARGET_TABLE = 'table_name';

async function clearTableData() {
  const db = new sqlite3.Database(DB_PATH);

  const runQuery = (sql: string, params: unknown[] = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  };

  try {
    await runQuery('BEGIN TRANSACTION;');

    const sanitizedTable = TARGET_TABLE.replace(/[`"']/g, '');

    await runQuery(`DELETE FROM \`${sanitizedTable}\`;`);

    try {
      await runQuery(`DELETE FROM sqlite_sequence WHERE name = ?;`, [TARGET_TABLE]);
    } catch (seqErr) {
      // Ignored if sequence doesn't exist
    }

    await runQuery('COMMIT;');
  } catch (err) {
    try {
      await runQuery('ROLLBACK;');
    } catch (rollbackErr) {
      // Ignored if transaction wasn't active
    }
  } finally {
    db.close();
  }
}

clearTableData();
