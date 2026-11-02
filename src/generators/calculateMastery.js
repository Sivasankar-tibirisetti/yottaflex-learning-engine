
const pool = require("../config/db");

const CALCULATION_VERSION = "v1";

async function calculateMastery() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Establish the evaluation cutoff for this calculation.
    const cutoffResult = await client.query(
      "SELECT NOW() AS cutoff_at"
    );

    const cutoffAt = cutoffResult.rows[0].cutoff_at;

    // Calculate mastery using only attempts available by the cutoff.
    const result = await client.query(
      `
      SELECT
        a.learner_id,
        cs.skill_id,
        COUNT(*)::integer AS attempts_count,
        ROUND(AVG(a.score), 2) AS mastery_score
      FROM attempts a
      JOIN content_skills cs
        ON cs.content_item_id = a.content_item_id
      WHERE a.attempt_status = 'completed'
        AND a.score IS NOT NULL
        AND a.started_at <= $1
        AND (a.completed_at IS NULL OR a.completed_at <= $1)
      GROUP BY a.learner_id, cs.skill_id
      ORDER BY a.learner_id, cs.skill_id
      `,
      [cutoffAt]
    );

    // Save each calculated estimate as a historical record.
    for (const row of result.rows) {
      await client.query(
        `
        INSERT INTO mastery_estimates (
          learner_id,
          skill_id,
          attempts_count,
          mastery_score,
          calculated_at,
          data_cutoff_at,
          calculation_version
        )
        VALUES ($1, $2, $3, $4, NOW(), $5, $6)
        `,
        [
          row.learner_id,
          row.skill_id,
          row.attempts_count,
          row.mastery_score,
          cutoffAt,
          CALCULATION_VERSION,
        ]
      );
    }

    await client.query("COMMIT");

    console.log("Mastery calculation completed.");
    console.log(`Evaluation cutoff: ${cutoffAt}`);
    console.log(`Learner-skill estimates saved: ${result.rows.length}`);
    console.table(result.rows.slice(0, 10));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Mastery calculation failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

calculateMastery();
