
const pool = require("../config/db");

const prerequisites = [
  {
    skillId: "SKL-000004",
    prerequisiteSkillId: "SKL-000003",
  },
];

const contentItems = [
  {
    id: "CNT-000001",
    courseId: "CRS-000001",
    title: "HTML Fundamentals",
    type: "lesson",
    difficulty: 1,
    minutes: 30,
    skillId: "SKL-000001",
  },
  {
    id: "CNT-000002",
    courseId: "CRS-000001",
    title: "CSS Fundamentals",
    type: "lesson",
    difficulty: 1,
    minutes: 40,
    skillId: "SKL-000002",
  },
  {
    id: "CNT-000003",
    courseId: "CRS-000001",
    title: "JavaScript Basics Quiz",
    type: "quiz",
    difficulty: 2,
    minutes: 20,
    skillId: "SKL-000003",
  },
  {
    id: "CNT-000004",
    courseId: "CRS-000001",
    title: "React Introduction",
    type: "lesson",
    difficulty: 2,
    minutes: 35,
    skillId: "SKL-000004",
  },
];

async function seedLearningContent() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const item of prerequisites) {
      await client.query(
        `INSERT INTO skill_prerequisites
          (skill_id, prerequisite_skill_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [item.skillId, item.prerequisiteSkillId]
      );
    }

    for (const item of contentItems) {
      await client.query(
        `INSERT INTO content_items
          (content_item_id, course_id, title, content_type,
           difficulty, estimated_minutes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (content_item_id) DO NOTHING`,
        [
          item.id,
          item.courseId,
          item.title,
          item.type,
          item.difficulty,
          item.minutes,
        ]
      );

      await client.query(
        `INSERT INTO content_skills
          (content_item_id, skill_id, relevance_weight)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [item.id, item.skillId, 1.0]
      );
    }

    await client.query("COMMIT");
    console.log("Prerequisites and learning content seeded successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seeding failed:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedLearningContent().catch(() => {
  process.exitCode = 1;
});
