const pool = require("./config/db");

async function testConnection() {
  try {
    const result = await pool.query(`
      SELECT current_database() AS database_name,
             COUNT(*) AS table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `);

    console.log("Database connected successfully!");
    console.log("Database:", result.rows[0].database_name);
    console.log("Tables:", result.rows[0].table_count);
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testConnection();