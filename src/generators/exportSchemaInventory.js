require("dotenv").config();
const pool = require("../config/db");
const fs = require("fs");
const path = require("path");

(async () => {
  try {
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    let output = "-- YottaFlex Learning Engine schema inventory\n";
    output += "-- Generated from the connected PostgreSQL database.\n";
    output += "-- Review the database DDL before using this as a restoration script.\n\n";

    for (const { table_name } of tables.rows) {
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table_name]);

      output += `-- Table: ${table_name}\n`;
      for (const col of columns.rows) {
        output += `--   ${col.column_name}: ${col.data_type}; nullable=${col.is_nullable}; default=${col.column_default ?? "none"}\n`;
      }

      const constraints = await pool.query(`
        SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) AS definition
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        WHERE ns.nspname = 'public' AND rel.relname = $1
        ORDER BY con.contype, con.conname
      `, [table_name]);

      for (const con of constraints.rows) {
        output += `--   Constraint ${con.conname} (${con.contype}): ${con.definition}\n`;
      }
      output += "\n";
    }

    const destination = path.resolve(__dirname, "../../sql/schema-inventory.sql");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, output, "utf8");

    console.log(`Schema inventory saved: ${destination}`);
    console.log(`Tables documented: ${tables.rows.length}`);
    console.log("Note: this is an inventory, not executable CREATE TABLE DDL.");
  } catch (err) {
    console.error("Schema export failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
