
const pool = require("../config/db");

async function validateLearningPathLoops() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pathId = "PATH-9999-000001";
    const learnerId = "LRN-000001";
    const courseId = "CRS-000001";
    const contentId = "CNT-000001";

    // Create a temporary learning path.
    await client.query(
      `INSERT INTO learning_paths (
         learning_path_id,
         learner_id,
         course_id,
         path_status,
         started_at
       )
       VALUES ($1, $2, $3, $4, NOW())`,
      [pathId, learnerId, courseId, "active"]
    );

    // Repeat the same content without progress.
    await client.query(
      `INSERT INTO learning_path_steps (
         learning_path_id,
         step_number,
         content_item_id,
         step_status
       )
       VALUES
         ($1, 1, $2, 'pending'),
         ($1, 2, $2, 'pending')`,
      [pathId, contentId]
    );

    // Detect repeated content without a completed step between occurrences.
    const result = await client.query(
      `SELECT
         current_step.learning_path_id,
         current_step.step_number,
         current_step.content_item_id,
         previous_step.step_number AS previous_step_number
       FROM learning_path_steps current_step
       JOIN learning_path_steps previous_step
         ON previous_step.learning_path_id =
            current_step.learning_path_id
        AND previous_step.content_item_id =
            current_step.content_item_id
        AND previous_step.step_number <
            current_step.step_number
       WHERE current_step.learning_path_id = $1
         AND NOT EXISTS (
           SELECT 1
           FROM learning_path_steps progress_step
           WHERE progress_step.learning_path_id =
                 current_step.learning_path_id
             AND progress_step.step_number >
                 previous_step.step_number
             AND progress_step.step_number <
                 current_step.step_number
             AND progress_step.step_status = 'completed'
         )
       ORDER BY current_step.step_number`,
      [pathId]
    );

    console.table(result.rows);

    if (result.rows.length === 0) {
      throw new Error("The learning-path loop was not detected.");
    }

    // Roll back all temporary path and step records.
    await client.query("ROLLBACK");

    console.log("PASS: Learning-path loop detected.");
    console.log("PASS: Synthetic test records rolled back.");

    // Save the validation result outside the rolled-back transaction.
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
        "EDGE-LEARNING-PATH-LOOP-001",
        "learning_path_loop",
        "learning_path",
        pathId,
        "Repeated content occurs without an intervening completed step."
      ]
    );

    console.log("PASS: Ground-truth case recorded.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    console.error("Learning-path validation failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

validateLearningPathLoops();
