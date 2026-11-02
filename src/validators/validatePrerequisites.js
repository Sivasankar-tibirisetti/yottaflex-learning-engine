
const pool = require("../config/db");

async function validatePrerequisites() {
  try {
    const result = await pool.query(`
      WITH latest_mastery AS (
        SELECT DISTINCT ON (learner_id, skill_id)
          learner_id,
          skill_id,
          mastery_score
        FROM mastery_estimates
        ORDER BY
          learner_id,
          skill_id,
          data_cutoff_at DESC,
          calculated_at DESC,
          mastery_estimate_id DESC
      ),
      test_case AS (
        SELECT
          'LRN-000001'::VARCHAR AS learner_id,
          'CNT-000004'::VARCHAR AS content_item_id,
          'EDGE-PREREQUISITE-001'::VARCHAR AS case_id
      )
      SELECT
        tc.case_id,
        tc.learner_id,
        tc.content_item_id,
        sp.prerequisite_skill_id,
        lm.mastery_score
      FROM test_case tc
      JOIN content_skills cs
        ON cs.content_item_id = tc.content_item_id
      JOIN skill_prerequisites sp
        ON sp.skill_id = cs.skill_id
      LEFT JOIN latest_mastery lm
        ON lm.learner_id = tc.learner_id
       AND lm.skill_id = sp.prerequisite_skill_id
      WHERE lm.mastery_score IS NULL
         OR lm.mastery_score < 60;
    `);

    if (result.rows.length === 0) {
      console.log(
        "FAIL: The synthetic prerequisite violation was not detected."
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      "PASS: The synthetic prerequisite violation was detected."
    );
    console.table(result.rows);

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
        "EDGE-PREREQUISITE-001",
        "prerequisite_violation",
        "synthetic_recommendation",
        "LRN-000001 -> CNT-000004",
        "Synthetic recommendation violates the prerequisite rule because prerequisite skill SKL-000003 has mastery below 60%."
      ]
    );

    console.log("Ground-truth case marked as detected.");
    console.log("No existing recommendations were changed.");
  } catch (error) {
    console.error("Prerequisite validation failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

validatePrerequisites();
