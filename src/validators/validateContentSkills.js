
const pool = require("../config/db");

async function validateContentSkills() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let constraintRejected = false;

    try {
      await client.query(
        `INSERT INTO content_skills (content_item_id, skill_id)
         VALUES ($1, $2)`,
        ["CNT-000001", "SKL-NONEXISTENT-999"]
      );
    } catch (error) {
      // PostgreSQL foreign-key violation.
      if (error.code === "23503") {
        constraintRejected = true;
      } else {
        throw error;
      }
    }

    // Never retain the synthetic test record.
    await client.query("ROLLBACK");

    if (!constraintRejected) {
      throw new Error(
        "The database did not reject the nonexistent skill mapping. Check the table constraints and column names."
      );
    }

    console.log(
      "PASS: PostgreSQL rejected the mapping to a nonexistent skill."
    );

    await pool.query(
      `INSERT INTO ground_truth (
         case_id,
         case_type,
         entity_type,
         entity_id,
         expected_violation,
         description,
         validation_status
       )
       VALUES (
         $1, $2, $3, $4, TRUE, $5, 'detected'
       )
       ON CONFLICT (case_id)
       DO UPDATE SET validation_status = 'detected'`,
      [
        "EDGE-CONTENT-SKILL-001",
        "invalid_content_skill_mapping",
        "content_skill_mapping",
        "CNT-000001 -> SKL-NONEXISTENT-999",
        "A content-to-skill mapping references a skill that does not exist; the database should reject it."
      ]
    );

    console.log("Ground-truth case marked as detected.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // Ignore rollback errors if no transaction is active.
    }

    console.error("Content-skill validation failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

validateContentSkills();
