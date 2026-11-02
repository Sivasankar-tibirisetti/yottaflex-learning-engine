
const pool = require("../config/db");

const learners = [
  {
    id: "LRN-000001",
    name: "Learner One",
    email: "learner1@example.com",
  },
  {
    id: "LRN-000002",
    name: "Learner Two",
    email: "learner2@example.com",
  },
  {
    id: "LRN-000003",
    name: "Learner Three",
    email: "learner3@example.com",
  },
];

const courses = [
  {
    id: "CRS-000001",
    name: "Full Stack Web Development",
    description: "Learn web development fundamentals.",
  },
];

const skills = [
  {
    id: "SKL-000001",
    name: "HTML",
    description: "Web page structure",
  },
  {
    id: "SKL-000002",
    name: "CSS",
    description: "Web page styling",
  },
  {
    id: "SKL-000003",
    name: "JavaScript",
    description: "Programming for web applications",
  },
  {
    id: "SKL-000004",
    name: "React",
    description: "Building user interfaces",
  },
];

async function seedMasterData() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const learner of learners) {
      await client.query(
        `INSERT INTO learners
           (learner_id, display_name, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (learner_id) DO NOTHING`,
        [learner.id, learner.name, learner.email]
      );
    }

    for (const course of courses) {
      await client.query(
        `INSERT INTO courses
           (course_id, course_name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (course_id) DO NOTHING`,
        [course.id, course.name, course.description]
      );
    }

    for (const skill of skills) {
      await client.query(
        `INSERT INTO skills
           (skill_id, skill_name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (skill_id) DO NOTHING`,
        [skill.id, skill.name, skill.description]
      );
    }

    await client.query("COMMIT");

    console.log("Master data seeded successfully.");
    console.log(`Learners defined: ${learners.length}`);
    console.log(`Courses defined: ${courses.length}`);
    console.log(`Skills defined: ${skills.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Master-data seeding failed:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedMasterData().catch(() => {
  process.exitCode = 1;
});
