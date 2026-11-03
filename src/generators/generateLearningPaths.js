
const pool = require("../config/db");

const TOTAL_PATHS = Number(process.env.TOTAL_LEARNING_PATHS || 100);
const STEPS_PER_PATH = 3;
const PATH_YEAR = 2026;

async function generateLearningPaths() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find learners with completed attempts in an existing course.
    // Select one eligible course per learner.
    const candidatesResult = await client.query(
      `
      WITH eligible_pairs AS (
        SELECT
          a.learner_id,
          ci.course_id,
          MIN(a.started_at) AS first_started_at
        FROM attempts a
        JOIN content_items ci
          ON ci.content_item_id = a.content_item_id
        WHERE a.attempt_status = 'completed'
          AND ci.course_id IS NOT NULL
          AND ci.content_status = 'active'
        GROUP BY a.learner_id, ci.course_id
      ),
      ranked_pairs AS (
        SELECT
          learner_id,
          course_id,
          first_started_at,
          ROW_NUMBER() OVER (
            PARTITION BY learner_id
            ORDER BY course_id
          ) AS course_rank
        FROM eligible_pairs
      )
      SELECT
        learner_id,
        course_id,
        first_started_at
      FROM ranked_pairs
      WHERE course_rank = 1
      ORDER BY learner_id
      LIMIT $1
      `,
      [TOTAL_PATHS]
    );

    if (candidatesResult.rowCount < TOTAL_PATHS) {
      throw new Error(
        `Only ${candidatesResult.rowCount} eligible learners found; ${TOTAL_PATHS} required.`
      );
    }

    let pathsInserted = 0;
    let stepsInserted = 0;

    for (let index = 0; index < candidatesResult.rows.length; index++) {
      const learner = candidatesResult.rows[index];

      const pathNumber = index + 1;
      const learningPathId =
        `PATH-${PATH_YEAR}-${String(pathNumber).padStart(6, "0")}`;

      // Pick three course items. The first must have a real
      // completed attempt by this learner.
      const contentResult = await client.query(
        `
        SELECT
          ci.content_item_id,
          a.attempt_id,
          a.started_at,
          a.completed_at
        FROM content_items ci
        LEFT JOIN LATERAL (
          SELECT
            attempt_id,
            started_at,
            completed_at
          FROM attempts
          WHERE learner_id = $1
            AND content_item_id = ci.content_item_id
            AND attempt_status = 'completed'
          ORDER BY completed_at, attempt_id
          LIMIT 1
        ) a ON TRUE
        WHERE ci.course_id = $2
          AND ci.content_status = 'active'
        ORDER BY
          (a.attempt_id IS NOT NULL) DESC,
          ci.content_item_id
        LIMIT $3
        `,
        [
          learner.learner_id,
          learner.course_id,
          STEPS_PER_PATH
        ]
      );

      const contentItems = contentResult.rows;

      if (
        contentItems.length !== STEPS_PER_PATH ||
        !contentItems[0].attempt_id
      ) {
        throw new Error(
          `Could not find valid content and completed activity for ${learner.learner_id}.`
        );
      }

      const pathStart = contentItems[0].started_at;

      // Check whether this generated path already exists.
      const existingPath = await client.query(
        `
        SELECT learner_id, course_id
        FROM learning_paths
        WHERE learning_path_id = $1
        `,
        [learningPathId]
      );

      if (existingPath.rowCount > 0) {
        const existing = existingPath.rows[0];

        if (
          existing.learner_id !== learner.learner_id ||
          existing.course_id !== learner.course_id
        ) {
          throw new Error(
            `Existing path ${learningPathId} belongs to different records.`
          );
        }
      } else {
        await client.query(
          `
          INSERT INTO learning_paths (
            learning_path_id,
            learner_id,
            course_id,
            path_status,
            started_at,
            completed_at
          )
          VALUES ($1, $2, $3, 'active', $4, NULL)
          `,
          [
            learningPathId,
            learner.learner_id,
            learner.course_id,
            pathStart
          ]
        );

        pathsInserted++;
      }

    // Reflect the learner's actual completion history for each item.
// A step is completed only when a real completed attempt exists.

for (let stepIndex = 0; stepIndex < contentItems.length; stepIndex++) {
  const item = contentItems[stepIndex];
  const stepNumber = stepIndex + 1;

  const hasCompletedAttempt = Boolean(item.attempt_id);

  const stepStatus = hasCompletedAttempt
    ? "completed"
    : "pending";

  const completedAt = hasCompletedAttempt
    ? item.completed_at
    : null;

  const stepResult = await client.query(
    `
    INSERT INTO learning_path_steps (
      learning_path_id,
      step_number,
      content_item_id,
      step_status,
      completed_at
    )
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (learning_path_id, step_number)
    DO NOTHING
    `,
    [
      learningPathId,
      stepNumber,
      item.content_item_id,
      stepStatus,
      completedAt
    ]
  );

  stepsInserted += stepResult.rowCount;
}

    }

    await client.query("COMMIT");

    console.log("Learning path generation completed.");
    console.log(`Paths inserted: ${pathsInserted}`);
    console.log(`Steps inserted: ${stepsInserted}`);
    console.log(`Paths processed: ${candidatesResult.rowCount}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Learning path generation failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

generateLearningPaths();
