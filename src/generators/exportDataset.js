
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

const TABLES = [
  "learners",
  "courses",
  "skills",
  "skill_prerequisites",
  "content_items",
  "content_skills",
  "attempts",
  "assessment_results",
  "mastery_estimates",
  "recommendations",
  "learning_paths",
  "learning_path_steps",
  "ground_truth",
];

const ROOT_DIR = path.join(__dirname, "../../data/exports");
const CSV_DIR = path.join(ROOT_DIR, "csv");
const JSON_DIR = path.join(ROOT_DIR, "json");

function escapeCsv(value) {
  if (value === null || value === undefined) return "";

  let output;

  if (value instanceof Date) {
    output = value.toISOString();
  } else if (typeof value === "object") {
    output = JSON.stringify(value);
  } else {
    output = String(value);
  }

  return `"${output.replace(/"/g, '""')}"`;
}

async function exportTable(client, tableName) {
  // Get primary-key columns to provide stable export ordering.
  const primaryKeyResult = await client.query(
    `
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = $1
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position
    `,
    [tableName]
  );

  const orderBy = primaryKeyResult.rows.length
    ? `ORDER BY ${primaryKeyResult.rows
        .map((row) => `"${row.column_name}"`)
        .join(", ")}`
    : "";

  const result = await client.query(
    `SELECT * FROM "${tableName}" ${orderBy}`
  );

  const columns = result.fields.map((field) => field.name);

  const lines = [
    columns.map(escapeCsv).join(","),
    ...result.rows.map((row) =>
      columns.map((column) => escapeCsv(row[column])).join(",")
    ),
  ];

  const csvPath = path.join(CSV_DIR, `${tableName}.csv`);

  fs.writeFileSync(csvPath, lines.join("\n") + "\n", "utf8");

  console.log(`${tableName}: ${result.rowCount} rows exported`);
}

async function main() {
  const client = await pool.connect();

  try {
    fs.mkdirSync(CSV_DIR, { recursive: true });
    fs.mkdirSync(JSON_DIR, { recursive: true });

    for (const table of TABLES) {
      await exportTable(client, table);
    }

    const groundTruthResult = await client.query(`
      SELECT *
      FROM ground_truth
      ORDER BY case_id
    `);

    fs.writeFileSync(
      path.join(JSON_DIR, "ground_truth.json"),
      JSON.stringify(groundTruthResult.rows, null, 2),
      "utf8"
    );

    console.log(
      `ground_truth.json: ${groundTruthResult.rowCount} cases exported`
    );

    console.log("Dataset export completed successfully.");
  } catch (error) {
    console.error("Dataset export failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
