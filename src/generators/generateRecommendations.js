
const pool = require("../config/db");

const MASTERY_THRESHOLD = Number(
  process.env.MASTERY_THRESHOLD || 60
);

async function generateRecommendations() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Load learners and active content.
    const learnersResult = await client.query(`
      SELECT learner_id
      FROM learners
      ORDER BY learner_id
    `);

    const contentResult = await client.query(`
      SELECT
        ci.content_item_id,
        ci.title,
        ci.content_type,
        ci.difficulty,
        cs.skill_id,
        cs.relevance_weight
      FROM content_items ci
      JOIN content_skills cs
        ON cs.content_item_id = ci.content_item_id
      WHERE ci.content_status = 'active'
      ORDER BY ci.content_item_id, cs.skill_id
    `);

    const prerequisitesResult = await client.query(`
      SELECT skill_id, prerequisite_skill_id
      FROM skill_prerequisites
    `);

   
    const masteryResult = await client.query(
      `
      SELECT DISTINCT ON (learner_id, skill_id)
        learner_id,
        skill_id,
        mastery_score
      FROM mastery_estimates
      WHERE data_cutoff_at <= NOW()
      ORDER BY
        learner_id,
        skill_id,
        data_cutoff_at DESC,
        calculated_at DESC,
        mastery_estimate_id DESC
      `
    );


    const attemptedResult = await client.query(`
      SELECT DISTINCT learner_id, content_item_id
      FROM attempts
    `);

    const masteryByLearner = new Map();

    for (const row of masteryResult.rows) {
      if (!masteryByLearner.has(row.learner_id)) {
        masteryByLearner.set(row.learner_id, new Map());
      }

      masteryByLearner.get(row.learner_id).set(
        row.skill_id,
        Number(row.mastery_score)
      );
    }

    const prerequisitesBySkill = new Map();

    for (const row of prerequisitesResult.rows) {
      if (!prerequisitesBySkill.has(row.skill_id)) {
        prerequisitesBySkill.set(row.skill_id, []);
      }

      prerequisitesBySkill.get(row.skill_id).push(
        row.prerequisite_skill_id
      );
    }

    const attemptedByLearner = new Map();

    for (const row of attemptedResult.rows) {
      if (!attemptedByLearner.has(row.learner_id)) {
        attemptedByLearner.set(row.learner_id, new Set());
      }

      attemptedByLearner.get(row.learner_id).add(row.content_item_id);
    }

    let inserted = 0;
    let skipped = 0;
    let sequence = 0;

    
    const existingPendingResult = await client.query(`
      SELECT DISTINCT learner_id
      FROM recommendations
      WHERE recommendation_status = 'recommended'
    `);

    const learnersWithPending = new Set(
      existingPendingResult.rows.map((row) => row.learner_id)
    );


    for (const learner of learnersResult.rows) {
        
      if (learnersWithPending.has(learner.learner_id)) {
        skipped++;
        continue;
      }

      const learnerMastery =
        masteryByLearner.get(learner.learner_id) || new Map();

      const attempted =
        attemptedByLearner.get(learner.learner_id) || new Set();

      // Prioritize weak or unassessed skills.
      const candidates = contentResult.rows
        .filter((item) => !attempted.has(item.content_item_id))
        .map((item) => {
          const mastery = learnerMastery.has(item.skill_id)
            ? learnerMastery.get(item.skill_id)
            : null;

          return {
            ...item,
            mastery,
            priority:
              mastery === null
                ? 1
                : mastery < MASTERY_THRESHOLD
                  ? 2
                  : 0,
          };
        })
        .filter((item) => item.priority > 0)
        .sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }

          if (a.mastery !== b.mastery) {
            return (a.mastery ?? -1) - (b.mastery ?? -1);
          }

          return (
            Number(b.relevance_weight) -
            Number(a.relevance_weight)
          );
        });

      let selected = null;

      for (const candidate of candidates) {
        const requiredSkills =
          prerequisitesBySkill.get(candidate.skill_id) || [];

        const prerequisitesSatisfied = requiredSkills.every(
          (skillId) => {
            const prerequisiteMastery = learnerMastery.get(skillId);

            return (
              prerequisiteMastery !== undefined &&
              prerequisiteMastery >= MASTERY_THRESHOLD
            );
          }
        );

        if (prerequisitesSatisfied) {
          selected = candidate;
          break;
        }
      }

      if (!selected) {
        skipped++;
        continue;
      }

      sequence++;

      const reasonCodes =
        selected.mastery === null
          ? ["COLD_START_SKILL", "PREREQUISITES_SATISFIED"]
          : ["LOW_SKILL_MASTERY", "PREREQUISITES_SATISFIED"];

      const rationale =
        selected.mastery === null
          ? `Recommend "${selected.title}" because the learner has no recorded mastery estimate for this skill, and its prerequisites are satisfied.`
          : `Recommend "${selected.title}" because estimated mastery is ${selected.mastery.toFixed(2)}%, below the configured threshold of ${MASTERY_THRESHOLD}%, and its prerequisites are satisfied.`;

      const recommendationId =
        `REC-${Date.now()}-${String(sequence).padStart(6, "0")}`;

      await client.query(
        `INSERT INTO recommendations (
          recommendation_id,
          learner_id,
          learning_path_id,
          content_item_id,
          generated_at,
          mastery_at_generation,
          reason_codes,
          rationale,
          recommendation_status,
          outcome_attempt_id
        )
        VALUES ($1, $2, NULL, $3, NOW(), $4, $5::jsonb, $6, 'recommended', NULL)`,
        [
          recommendationId,
          learner.learner_id,
          selected.content_item_id,
          selected.mastery,
          JSON.stringify(reasonCodes),
          rationale,
        ]
      );

      inserted++;
    }

    await client.query("COMMIT");

    console.log("Recommendation generation completed.");
    console.log(`Recommendations inserted: ${inserted}`);
    console.log(`Learners with no eligible content: ${skipped}`);
    console.log(`Mastery threshold: ${MASTERY_THRESHOLD}%`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Recommendation generation failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

generateRecommendations();
