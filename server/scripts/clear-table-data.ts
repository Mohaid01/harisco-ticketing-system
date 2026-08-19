import path from 'path';
import sqlite3 from 'sqlite3';

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'database.sqlite');
const TARGET_TABLE = 'factory_users';

async function clearTableData() {
  console.log(`Connecting to database at: ${DB_PATH}`);
  const db = new sqlite3.Database(DB_PATH);

  // Simple promise wrapper for database actions
  const runQuery = (sql: string, params: any[] = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  };

  try {
    console.log('Starting transaction...');
    await runQuery('BEGIN TRANSACTION;');

    console.log(`Clearing all data from table: ${TARGET_TABLE}`);
    const sanitizedTable = TARGET_TABLE.replace(/[`"']/g, '');
    await runQuery(`DELETE FROM \`${sanitizedTable}\`;`);

    console.log('Resetting auto-increment sequence...');
    try {
      await runQuery(`DELETE FROM sqlite_sequence WHERE name = ?;`, [TARGET_TABLE]);
    } catch (seqErr) {
      console.log('Note: No auto-increment sequence found to reset.');
    }

    console.log('Committing changes to disk...');
    await runQuery('COMMIT;');
    console.log('Success! Table cleared completely.');
  } catch (err: any) {
    console.error(`Error encountered: ${err.message}`);
    console.log('Rolling back transaction...');
    try {
      await runQuery('ROLLBACK;');
      console.log('Rollback successful.');
    } catch (rollbackErr) {
      console.error('Failed to rollback (transaction may not have started).');
    }
  } finally {
    console.log('Closing database connection.');
    db.close();
  }
}

clearTableData();
