
const pool = require("../config/db");

// Configuration: use small counts for development.
// Increase these through environment variables for the full dataset.
const CONFIG = {
  seed: Number(process.env.DATA_SEED || 20261022),
  learners: Number(process.env.LEARNER_COUNT || 10),
  courses: Number(process.env.COURSE_COUNT || 5),
  skills: Number(process.env.SKILL_COUNT || 10),
  contentItems: Number(process.env.CONTENT_COUNT || 20),
};

// Reproducible pseudo-random number generator.
// The same seed produces the same sequence of numbers.
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

function generateLearners(count) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;

    const names = [
      "Learner One",
      "Learner Two",
      "Learner Three",
    ];

    return {
      id: makeId("LRN", number),
      name: names[index] || `Learner ${String(number).padStart(6, "0")}`,
      email: `learner${number}@example.com`,
    };
  });
}

function generateCourses(count) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;

    return {
      id: makeId("CRS", number),
      name:
        number === 1
          ? "Full Stack Web Development"
          : `Learning Course ${String(number).padStart(3, "0")}`,
      description:
        number === 1
          ? "Learn web development fundamentals."
          : `Synthetic course ${number}`,
    };
  });
}

function generateSkills(count) {
  const initialSkills = [
    ["HTML", "Web page structure"],
    ["CSS", "Web page styling"],
    ["JavaScript", "Programming for web applications"],
    ["React", "Building user interfaces"],
  ];

  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const knownSkill = initialSkills[index];

    return {
      id: makeId("SKL", number),
      name: knownSkill
        ? knownSkill[0]
        : `Skill ${String(number).padStart(3, "0")}`,
      description: knownSkill
        ? knownSkill[1]
        : `Synthetic skill ${number}`,
    };
  });
}

function generatePrerequisites(skills) {
  const prerequisites = [];

  // React requires JavaScript in our example.
  if (skills.length >= 4) {
    prerequisites.push({
      skillId: skills[3].id,
      prerequisiteSkillId: skills[2].id,
    });
  }

  // Additional skills depend only on earlier skills.
  // This prevents the generator from creating backward cycles.
  for (let index = 4; index < skills.length; index++) {
    prerequisites.push({
      skillId: skills[index].id,
      prerequisiteSkillId: skills[index - 1].id,
    });

    if (index >= 6 && index % 3 === 0) {
      prerequisites.push({
        skillId: skills[index].id,
        prerequisiteSkillId: skills[index - 2].id,
      });
    }
  }

  return prerequisites;
}

function generateContentItems(count, courses, skills, random) {
  const initialContent = [
    ["HTML Fundamentals", "lesson", 1, 30],
    ["CSS Fundamentals", "lesson", 1, 40],
    ["JavaScript Basics Quiz", "quiz", 2, 20],
    ["React Introduction", "lesson", 2, 35],
  ];

  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const knownContent = initialContent[index];

    return {
      id: makeId("CNT", number),
      courseId: courses[index % courses.length].id,
      title: knownContent
        ? knownContent[0]
        : `Learning Activity ${String(number).padStart(4, "0")}`,
      type: knownContent
        ? knownContent[1]
        : ["lesson", "quiz", "coding_exercise", "project"][
            Math.floor(random() * 4)
          ],
      difficulty: knownContent
        ? knownContent[2]
        : 1 + Math.floor(random() * 5),
      minutes: knownContent
        ? knownContent[3]
        : 15 + Math.floor(random() * 46),
      skillId: skills[index % skills.length].id,
    };
  });
}

// Insert records in batches to avoid one database query per record.
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

async function main() {
  const counts = [
    CONFIG.learners,
    CONFIG.courses,
    CONFIG.skills,
    CONFIG.contentItems,
  ];

  if (
    counts.some((count) => !Number.isSafeInteger(count) || count < 1) ||
    CONFIG.skills < 4 ||
    CONFIG.courses < 1
  ) {
    throw new Error(
      "Counts must be positive integers, with at least 4 skills."
    );
  }

  const random = createRandom(CONFIG.seed);

  const learners = generateLearners(CONFIG.learners);
  const courses = generateCourses(CONFIG.courses);
  const skills = generateSkills(CONFIG.skills);
  const prerequisites = generatePrerequisites(skills);
  const content = generateContentItems(
    CONFIG.contentItems,
    courses,
    skills,
    random
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Parent records first.
    await insertBatches(
      client,
      "learners",
      ["learner_id", "display_name", "email"],
      learners.map((item) => [item.id, item.name, item.email]),
      `ON CONFLICT (learner_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        email = EXCLUDED.email`
    );

    await insertBatches(
      client,
      "courses",
      ["course_id", "course_name", "description"],
      courses.map((item) => [item.id, item.name, item.description]),
      `ON CONFLICT (course_id) DO UPDATE SET
        course_name = EXCLUDED.course_name,
        description = EXCLUDED.description`
    );

    await insertBatches(
      client,
      "skills",
      ["skill_id", "skill_name", "description"],
      skills.map((item) => [item.id, item.name, item.description]),
      `ON CONFLICT (skill_id) DO UPDATE SET
        skill_name = EXCLUDED.skill_name,
        description = EXCLUDED.description`
    );

    // Dependent records after their parent skills and courses.
   
    // Synchronize prerequisite relationships owned by this generator.
    // Only generated skill IDs are affected.
    const generatedSkillIds = skills.map((item) => item.id);

    await client.query(
      `DELETE FROM skill_prerequisites
       WHERE skill_id = ANY($1::varchar[])`,
      [generatedSkillIds]
    );

    for (const item of prerequisites) {
      await client.query(
        `INSERT INTO skill_prerequisites
          (skill_id, prerequisite_skill_id)
         VALUES ($1, $2)`,
        [item.skillId, item.prerequisiteSkillId]
      );
    }

    // Synchronize mappings owned by this generator.
    // Only generated content IDs are affected.
    const generatedContentIds = content.map((item) => item.id);

    await client.query(
      `DELETE FROM content_skills
       WHERE content_item_id = ANY($1::varchar[])`,
      [generatedContentIds]
    );


    await insertBatches(
      client,
      "content_items",
      [
        "content_item_id",
        "course_id",
        "title",
        "content_type",
        "difficulty",
        "estimated_minutes",
      ],
      content.map((item) => [
        item.id,
        item.courseId,
        item.title,
        item.type,
        item.difficulty,
        item.minutes,
      ]),
      `ON CONFLICT (content_item_id) DO UPDATE SET
        course_id = EXCLUDED.course_id,
        title = EXCLUDED.title,
        content_type = EXCLUDED.content_type,
        difficulty = EXCLUDED.difficulty,
        estimated_minutes = EXCLUDED.estimated_minutes`
    );

    for (const item of content) {
      await client.query(
        `INSERT INTO content_skills
          (content_item_id, skill_id, relevance_weight)
         VALUES ($1, $2, 1.0)
         ON CONFLICT DO NOTHING`,
        [item.id, item.skillId]
      );
    }

    await client.query("COMMIT");

    console.log("Master-data generation completed.");
    console.log(`Seed: ${CONFIG.seed}`);
    console.log(`Learners generated: ${learners.length}`);
    console.log(`Courses generated: ${courses.length}`);
    console.log(`Skills generated: ${skills.length}`);
    console.log(`Prerequisites generated: ${prerequisites.length}`);
    console.log(`Content items generated: ${content.length}`);
    console.log(`Content mappings generated: ${content.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Generation failed:", error.message);
  process.exitCode = 1;
});
