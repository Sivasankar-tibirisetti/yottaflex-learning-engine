
const pool = require("../config/db");

async function recordFutureAttemptGroundTruth() {
  try {
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
       VALUES ($1, $2, $3, $4, TRUE, $5, 'detected')
       ON CONFLICT (case_id)
       DO UPDATE SET validation_status = 'detected'`,
      [
        "EDGE-FUTURE-MASTERY-001",
        "future_attempt_mastery",
        "mastery_estimate",
        "LRN-000010 -> SKL-000003",
        "A future attempt must not influence a historical mastery estimate calculated using an earlier data cutoff."
      ]
    );

    console.log("PASS: Future-attempt case recorded in ground_truth.");
  } catch (error) {
    console.error("Ground-truth recording failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

recordFutureAttemptGroundTruth();
