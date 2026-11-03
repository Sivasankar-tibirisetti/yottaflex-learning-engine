
const pool = require("../config/db");

async function recordRecommendationOutcome(
  recommendationId,
  attemptId
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock and retrieve the recommendation.
    const recommendationResult = await client.query(
      `SELECT recommendation_id, learner_id, content_item_id,
              recommendation_status, outcome_attempt_id
       FROM recommendations
       WHERE recommendation_id = $1
       FOR UPDATE`,
      [recommendationId]
    );

    if (recommendationResult.rowCount === 0) {
      throw new Error("Recommendation not found.");
    }

    const recommendation = recommendationResult.rows[0];

   if (!["recommended", "accepted"].includes(
  recommendation.recommendation_status
)) {
  throw new Error(
    `Cannot record outcome for recommendation with status: ${recommendation.recommendation_status}`
  );
}

    if (recommendation.outcome_attempt_id !== null) {
      throw new Error("Recommendation already has an outcome attempt.");
    }

    // The attempt must belong to the same learner and content.
    const attemptResult = await client.query(
      `SELECT attempt_id, learner_id, content_item_id, attempt_status
       FROM attempts
       WHERE attempt_id = $1
       FOR UPDATE`,
      [attemptId]
    );

    if (attemptResult.rowCount === 0) {
      throw new Error("Attempt not found.");
    }

    const attempt = attemptResult.rows[0];

    if (attempt.learner_id !== recommendation.learner_id) {
      throw new Error("Attempt belongs to a different learner.");
    }

    if (attempt.content_item_id !== recommendation.content_item_id) {
      throw new Error("Attempt is for different content.");
    }

    if (attempt.attempt_status !== "completed") {
      throw new Error("Attempt is not completed.");
    }

    // Link the outcome and update the recommendation atomically.
    await client.query(
      `UPDATE recommendations
       SET recommendation_status = 'completed',
           outcome_attempt_id = $2
       WHERE recommendation_id = $1`,
      [recommendationId, attemptId]
    );

    await client.query("COMMIT");

    console.log("Recommendation outcome recorded successfully.");
    console.log(`Recommendation: ${recommendationId}`);
    console.log(`Outcome attempt: ${attemptId}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    const recommendationId = process.argv[2];
    const attemptId = process.argv[3];

    if (!recommendationId || !attemptId) {
      throw new Error(
        "Usage: node src/generators/recordRecommendationOutcome.js <recommendation_id> <attempt_id>"
      );
    }

    await recordRecommendationOutcome(
      recommendationId,
      attemptId
    );
  } catch (error) {
    console.error("Outcome recording failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
