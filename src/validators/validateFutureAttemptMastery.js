
const pool = require("../config/db");

async function validateFutureAttemptMastery() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const estimateResult = await client.query(
      `SELECT
         mastery_estimate_id,
         learner_id,
         skill_id,
         mastery_score,
         attempts_count,
         data_cutoff_at
       FROM mastery_estimates
       WHERE learner_id = $1
         AND skill_id = $2
       ORDER BY data_cutoff_at DESC,
                calculated_at DESC,
                mastery_estimate_id DESC
       LIMIT 1`,
      ["LRN-000010", "SKL-000003"]
    );

    if (estimateResult.rows.length === 0) {
      throw new Error("No mastery estimate found for the test learner and skill.");
    }

    const estimate = estimateResult.rows[0];

    const futureAttemptResult = await client.query(
      `SELECT content_item_id
       FROM content_skills
       WHERE skill_id = $1
       ORDER BY content_item_id
       LIMIT 1`,
      [estimate.skill_id]
    );

    if (futureAttemptResult.rows.length === 0) {
      throw new Error("No content item maps to the test skill.");
    }

    const contentItemId = futureAttemptResult.rows[0].content_item_id;

    const cutoff = new Date(estimate.data_cutoff_at);
    const futureStart = new Date(cutoff.getTime() + 60 * 60 * 1000);
    const futureCompletion = new Date(futureStart.getTime() + 30 * 60 * 1000);

    const attemptId = "ATT-FUTURE-TEST-001";

    // Insert only inside a transaction; always roll back this test record.
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
       VALUES ($1, $2, $3, 1, $4, $5, 100, 'completed', NOW())`,
      [
        attemptId,
        estimate.learner_id,
        contentItemId,
        futureStart.toISOString(),
        futureCompletion.toISOString()
      ]
    );

    // Recalculate using only attempts completed by the historical cutoff.
    const recalculationResult = await client.query(
      `SELECT
         COUNT(*)::INTEGER AS attempts_count,
         ROUND(AVG(score)::NUMERIC, 2) AS mastery_score
       FROM attempts a
       JOIN content_skills cs
         ON cs.content_item_id = a.content_item_id
       WHERE a.learner_id = $1
         AND cs.skill_id = $2
         AND a.attempt_status = 'completed'
         AND a.started_at <= $3
         AND a.completed_at <= $3`,
      [
        estimate.learner_id,
        estimate.skill_id,
        estimate.data_cutoff_at
      ]
    );

    const recalculated = recalculationResult.rows[0];

    const countMatches =
      Number(recalculated.attempts_count) === estimate.attempts_count;

    const scoreMatches =
      recalculated.mastery_score === null
        ? estimate.mastery_score === null
        : Number(recalculated.mastery_score) ===
          Number(estimate.mastery_score);

    await client.query("ROLLBACK");

    if (!countMatches || !scoreMatches) {
      throw new Error(
        "FAIL: Historical mastery does not match attempts available by its cutoff."
      );
    }

    console.log(
      "PASS: The future attempt did not affect the historical mastery estimate."
    );
    console.log("Learner:", estimate.learner_id);
    console.log("Skill:", estimate.skill_id);
    console.log("Stored mastery:", estimate.mastery_score);
    console.log("Recalculated mastery:", recalculated.mastery_score);
    console.log("Stored attempt count:", estimate.attempts_count);
    console.log("Recalculated attempt count:", recalculated.attempts_count);
    console.log("Synthetic future attempt rolled back; no test attempt retained.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    console.error("Future-attempt validation failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

validateFutureAttemptMastery();
