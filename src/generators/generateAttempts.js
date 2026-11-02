
const pool = require("../config/db");

const SEED = Number(process.env.DATA_SEED || 20261022);
const ATTEMPTS_PER_LEARNER = Number(
  process.env.ATTEMPTS_PER_LEARNER || 8
);

// Repeatable pseudo-random number generator.
function createRandom(seed) {
  let state = seed >>> 0;

  return function random() {
    state += 0x6D2B79F5;

    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function makeId(prefix, number) {
  return `${prefix}-${String(number).padStart(6, "0")}`;
}


async function insertBatches(client, table, columns, rows, conflictSql) {
  const batchSize = 500;

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const values = [];
    const placeholders = [];

    batch.forEach((row, rowIndex) => {
      const rowPlaceholders = row.map((value, columnIndex) => {
        values.push(value);
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });

      placeholders.push(`(${rowPlaceholders.join(", ")})`);
    });

    const query = `
      INSERT INTO ${table} (${columns.join(", ")})
      VALUES ${placeholders.join(", ")}
      ${conflictSql}
    `;

    await client.query(query, values);
  }
}


function generateAttemptRecords(learners, contentItems, seed) {
  const random = createRandom(seed);
  const attempts = [];
  const assessmentResults = [];
  const attemptCounts = new Map();

  // Fixed starting date makes generated timestamps reproducible.
  const baseTime = Date.parse("2026-01-01T09:00:00.000Z");

  let assessmentSequence = 0;

  for (const learner of learners) {
    for (let index = 0; index < ATTEMPTS_PER_LEARNER; index++) {
      const contentIndex = Math.floor(
        random() * contentItems.length
      );
      const content = contentItems[contentIndex];

      const key = `${learner.learner_id}:${content.content_item_id}`;
      const attemptNumber = (attemptCounts.get(key) || 0) + 1;

      attemptCounts.set(key, attemptNumber);

      const attemptId =
        `ATT-${learner.learner_id}-${String(index + 1).padStart(6, "0")}`;

   
      // Distribute attempts across a fixed 300-day window.
      // This keeps timestamps reproducible and before the
      // November 2026 evaluation cutoff.
      const dayOffset =
        (learner.sequence * ATTEMPTS_PER_LEARNER + index) % 300;

      const startedAt = new Date(
        baseTime + dayOffset * 24 * 60 * 60 * 1000
      );


      const completedAt = new Date(
        startedAt.getTime() + (10 + Math.floor(random() * 50)) * 60 * 1000
      );

      const score = Math.round(random() * 10000) / 100;

      attempts.push({
        attemptId,
        learnerId: learner.learner_id,
        contentItemId: content.content_item_id,
        attemptNumber,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        score,
        status: "completed",
        contentType: content.content_type,
      });

      // Assessment results are created for quiz and coding exercises.
      if (
        content.content_type === "quiz" ||
        content.content_type === "coding_exercise"
      ) {
        assessmentSequence++;

        assessmentResults.push({
          id: makeId("ASR", assessmentSequence),
          attemptId,
          score,
          passed: score >= 60,
          assessedAt: completedAt.toISOString(),
          gradingVersion: "v1",
        });
      }
    }
  }

  return { attempts, assessmentResults };
}

async function main() {
  if (
    !Number.isSafeInteger(ATTEMPTS_PER_LEARNER) ||
    ATTEMPTS_PER_LEARNER < 1
  ) {
    throw new Error("ATTEMPTS_PER_LEARNER must be a positive integer.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const learnerResult = await client.query(`
      SELECT learner_id
      FROM learners
      ORDER BY learner_id
    `);

    const contentResult = await client.query(`
      SELECT content_item_id, content_type
      FROM content_items
      WHERE content_status = 'active'
      ORDER BY content_item_id
    `);

    if (learnerResult.rows.length === 0) {
      throw new Error("No learners found. Generate master data first.");
    }

    if (contentResult.rows.length === 0) {
      throw new Error("No active content found. Generate content first.");
    }

    const learners = learnerResult.rows.map((learner, sequence) => ({
      ...learner,
      sequence,
    }));

    const { attempts, assessmentResults } = generateAttemptRecords(
      learners,
      contentResult.rows,
      SEED
    );

   
await insertBatches(
  client,
  "attempts",
  [
    "attempt_id",
    "learner_id",
    "content_item_id",
    "attempt_number",
    "started_at",
    "completed_at",
    "score",
    "attempt_status"
  ],
  attempts.map((attempt) => [
    attempt.attemptId,
    attempt.learnerId,
    attempt.contentItemId,
    attempt.attemptNumber,
    attempt.startedAt,
    attempt.completedAt,
    attempt.score,
    attempt.status
  ]),
  `ON CONFLICT (attempt_id) DO UPDATE SET
    learner_id = EXCLUDED.learner_id,
    content_item_id = EXCLUDED.content_item_id,
    attempt_number = EXCLUDED.attempt_number,
    started_at = EXCLUDED.started_at,
    completed_at = EXCLUDED.completed_at,
    score = EXCLUDED.score,
    attempt_status = EXCLUDED.attempt_status`
);


  
await insertBatches(
  client,
  "assessment_results",
  [
    "assessment_result_id",
    "attempt_id",
    "score",
    "passed",
    "assessed_at",
    "grading_version"
  ],
  assessmentResults.map((result) => [
    result.id,
    result.attemptId,
    result.score,
    result.passed,
    result.assessedAt,
    result.gradingVersion
  ]),
  `ON CONFLICT (assessment_result_id) DO UPDATE SET
    attempt_id = EXCLUDED.attempt_id,
    score = EXCLUDED.score,
    passed = EXCLUDED.passed,
    assessed_at = EXCLUDED.assessed_at,
    grading_version = EXCLUDED.grading_version`
);

    

    await client.query("COMMIT");

    console.log("Attempt generation completed.");
    console.log(`Seed: ${SEED}`);
    console.log(`Learners processed: ${learners.length}`);
    console.log(`Attempts generated: ${attempts.length}`);
    console.log(`Assessment results generated: ${assessmentResults.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Attempt generation failed:", error.message);
  process.exitCode = 1;
});
