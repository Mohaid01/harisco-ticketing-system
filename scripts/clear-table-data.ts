import path from "path";
import sqlite3 from "sqlite3";

// === CONFIGURATION ===
const DB_PATH =
  process.env.DB_PATH || path.resolve(process.cwd(), "database.sqlite");
const TARGET_TABLE = "factory_users"; // The table you want to empty

function clearTableData() {
  // 1. Open database connection
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error("❌ Error opening database:", err.message);
      return;
    }
  });

  // 2. Serialize forces operations to run in sequential order
  db.serialize(() => {
    console.log(`🧹 Clearing all rows from table "${TARGET_TABLE}"...`);

    // Start manual transaction block
    db.run("BEGIN TRANSACTION;");

    // Empty the table data
    db.run(`DELETE FROM ${TARGET_TABLE};`, (err) => {
      if (err) {
        console.error(
          `❌ Error deleting data from ${TARGET_TABLE}:`,
          err.message,
        );
        db.run("ROLLBACK;"); // Undo everything if it fails
        return;
      }
    });

    // Reset auto-increment counter to 1
    db.run(
      `DELETE FROM sqlite_sequence WHERE name = ?;`,
      [TARGET_TABLE],
      (err) => {
        if (err) {
          // We don't rollback here because some tables don't use auto-increment keys
          console.log(
            `ℹ️ Note: Auto-increment sequence not found or not reset.`,
          );
        }
      },
    );

    // Commit the changes to disk
    db.run("COMMIT;", (err) => {
      if (err) {
        console.error("❌ Failed to commit transaction:", err.message);
      } else {
        console.log(`\n✅ Success! Table "${TARGET_TABLE}" is now empty.`);
        console.log(`ℹ️ Note: Table structure and schema are fully preserved.`);
      }

      // 3. Close connection after completion
      db.close();
    });
  });
}

clearTableData();
