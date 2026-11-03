
const pool = require("../config/db");
const { randomUUID } = require("crypto");

async function validateFutureAttemptMastery() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find a historical estimate that matches the actual attempts
    // available at its recorded cutoff.
    const estimateResult = await client.query(`
      SELECT
        me.mastery_estimate_id,
        me.learner_id,
        me.skill_id,
        me.mastery_score,
        me.attempts_count,
        me.data_cutoff_at
      FROM mastery_estimates me
      LEFT JOIN content_skills cs
        ON cs.skill_id = me.skill_id
      LEFT JOIN attempts a
        ON a.content_item_id = cs.content_item_id
       AND a.learner_id = me.learner_id
       AND a.attempt_status = 'completed'
       AND a.score IS NOT NULL
       AND a.started_at <= me.data_cutoff_at
       AND (
         a.completed_at IS NULL
         OR a.completed_at <= me.data_cutoff_at
       )
      GROUP BY me.mastery_estimate_id
      HAVING COUNT(a.attempt_id) = me.attempts_count
         AND ROUND(AVG(a.score)::NUMERIC, 2)
             IS NOT DISTINCT FROM me.mastery_score
         AND me.attempts_count > 0
      ORDER BY
        me.data_cutoff_at DESC,
        me.calculated_at DESC,
        me.mastery_estimate_id DESC
      LIMIT 1
    `);

    if (estimateResult.rows.length === 0) {
      throw new Error(
        "No consistent historical mastery estimate found."
      );
    }

    const estimate = estimateResult.rows[0];

    // Find content mapped to this skill and calculate
    // the next attempt number for this learner and content.
    const contentResult = await client.query(
      `
      SELECT
        cs.content_item_id,
        COALESCE(MAX(a.attempt_number), 0) + 1 AS next_attempt_number
      FROM content_skills cs
      LEFT JOIN attempts a
        ON a.content_item_id = cs.content_item_id
       AND a.learner_id = $1
      WHERE cs.skill_id = $2
      GROUP BY cs.content_item_id
      ORDER BY cs.content_item_id
      LIMIT 1
      `,
      [estimate.learner_id, estimate.skill_id]
    );

    if (contentResult.rows.length === 0) {
      throw new Error("No content item found for the selected skill.");
    }

    const content = contentResult.rows[0];

    // Create a synthetic attempt strictly after the historical cutoff.
    const cutoff = new Date(estimate.data_cutoff_at);
    const futureStart = new Date(cutoff.getTime() + 60 * 60 * 1000);
    const futureCompletion = new Date(
      futureStart.getTime() + 30 * 60 * 1000
    );

    const attemptId = `ATT-FUTURE-${randomUUID()}`;

    await client.query(
      `
      INSERT INTO attempts (
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
      VALUES ($1, $2, $3, $4, $5, $6, 100, 'completed', NOW())
      `,
      [
        attemptId,
        estimate.learner_id,
        content.content_item_id,
        content.next_attempt_number,
        futureStart.toISOString(),
        futureCompletion.toISOString()
      ]
    );

    // Recalculate mastery using the ORIGINAL historical cutoff.
    const recalculationResult = await client.query(
      `
      SELECT
        COUNT(*)::INTEGER AS attempts_count,
        ROUND(AVG(a.score)::NUMERIC, 2) AS mastery_score
      FROM attempts a
      JOIN content_skills cs
        ON cs.content_item_id = a.content_item_id
      WHERE a.learner_id = $1
        AND cs.skill_id = $2
        AND a.attempt_status = 'completed'
        AND a.score IS NOT NULL
        AND a.started_at <= $3
        AND (
          a.completed_at IS NULL
          OR a.completed_at <= $3
        )
      `,
      [
        estimate.learner_id,
        estimate.skill_id,
        estimate.data_cutoff_at
      ]
    );

    const recalculated = recalculationResult.rows[0];

    const countMatches =
      Number(recalculated.attempts_count) ===
      Number(estimate.attempts_count);

    const scoreMatches =
      recalculated.mastery_score === null
        ? estimate.mastery_score === null
        : Number(recalculated.mastery_score) ===
          Number(estimate.mastery_score);

    // Always roll back the synthetic attempt.
    await client.query("ROLLBACK");

    if (!countMatches || !scoreMatches) {
      throw new Error(
        "FAIL: Future attempt affected historical mastery."
      );
    }

    console.log(
      "PASS: Future attempt did not affect historical mastery."
    );
    console.log("Learner:", estimate.learner_id);
    console.log("Skill:", estimate.skill_id);
    console.log("Historical cutoff:", estimate.data_cutoff_at);
    console.log("Stored mastery:", estimate.mastery_score);
    console.log("Recalculated mastery:", recalculated.mastery_score);
    console.log("Stored attempts:", estimate.attempts_count);
    console.log("Recalculated attempts:", recalculated.attempts_count);
    console.log("Synthetic future attempt rolled back successfully.");

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
