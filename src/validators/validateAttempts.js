
const pool = require("../config/db");

async function validateAttempts() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let constraintRejected = false;

    try {
      await client.query(
        `INSERT INTO attempts (
          attempt_id,
          learner_id,
          content_item_id,
          attempt_number,
          started_at,
          completed_at,
          score,
          attempt_status,
          created_at
        )
        VALUES (
          $1, $2, $3, 1,
          $4, $5, 50, 'completed', NOW()
        )`,
        [
          "ATT-TIMESTAMP-TEST-001",
          "LRN-000001",
          "CNT-000001",
          "2026-01-02T12:00:00Z",
          "2026-01-01T12:00:00Z"
        ]
      );
    } catch (error) {
      if (error.code === "23514") {
        constraintRejected = true;
      } else {
        throw error;
      }
    }

    // Always roll back the test transaction.
    await client.query("ROLLBACK");

    if (!constraintRejected) {
      throw new Error(
        "PostgreSQL did not reject the invalid timestamp."
      );
    }

    console.log(
      "PASS: PostgreSQL rejected the invalid timestamp."
    );

    await pool.query(
      `UPDATE ground_truth
       SET validation_status = 'detected'
       WHERE case_id = $1`,
      ["EDGE-TIMESTAMP-001"]
    );

    console.log("Ground-truth case marked as detected.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // The transaction may already have been rolled back.
    }

    console.error("Timestamp validation failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

validateAttempts();
