# YottaFlex Learning Engine

A backend learning recommendation engine built with **Node.js, JavaScript and PostgreSQL**. The system estimates learner skill mastery from historical assessment attempts, evaluates skill prerequisites, recommends suitable learning content, and tracks recommendation outcomes and learning-path progress.

The project uses a synthetic learning dataset to demonstrate data modeling, recommendation logic, temporal mastery calculations, edge-case handling and database validation.

## 1. Technology Stack

- **Runtime:** Node.js
- **Language:** JavaScript
- **Database:** PostgreSQL
- **Database client:** `pg`
- **Environment configuration:** `dotenv`
- **Database administration:** pgAdmin
- **Version control:** Git and GitHub

## 2. Core Features

- Relational data model for learners, courses, skills, content and assessment attempts.
- Skill prerequisite relationships and content-to-skill mappings.
- Historical skill mastery calculation using learner attempt data.
- Content recommendations based on mastery levels and prerequisite eligibility.
- Recommendation reason codes and human-readable rationales.
- Recommendation outcome tracking against completed attempts.
- Learning paths with ordered content steps and progress statuses.
- Ground-truth records for known data-quality and recommendation edge cases.
- Validation scripts to identify and test important data integrity conditions.

## 3. Database Entities

The PostgreSQL database contains the following core entities:

| Entity | Purpose |
|---|---|
| `learners` | Learner information and lifecycle status |
| `courses` | Course master data |
| `skills` | Skill definitions |
| `skill_prerequisites` | Dependencies between skills |
| `content_items` | Learning content and difficulty information |
| `content_skills` | Mapping between content and skills |
| `attempts` | Learner activity and assessment attempts |
| `assessment_results` | Assessment scores |
| `mastery_estimates` | Calculated learner skill mastery over time |
| `recommendations` | Recommended learning content, rationale and outcomes |
| `learning_paths` | Learner-specific learning paths |
| `learning_path_steps` | Ordered content and progress within a path |
| `ground_truth` | Known edge cases and their validation status |

## 4. Dataset Overview

The current recorded database contains:

| Dataset | Records |
|---|---:|
| Learners | 10,000 |
| Courses | 50 |
| Skills | 500 |
| Skill prerequisites | 662 |
| Content items | 2,000 |
| Content-skill mappings | 2,000 |
| Attempts | 500,001 |
| Assessment results | 242,564 |
| Mastery estimates | 476,769 |
| Recommendations | 20,010 |
| Learning paths | 100 |
| Learning-path steps | 300 |
| Ground-truth cases | 5 |

The dataset includes synthetic learner activity, multiple content types, assessment scores, skill mastery estimates and recommendation records.

**Note:** The recorded attempt count is 500,001, one above the 500,000 baseline target. The additional record has not yet been attributed to a specific generation run.

## 5. Recommendation Workflow

The recommendation workflow follows these stages:

1. Load learner, skill, prerequisite and learning-content data.
2. Retrieve historical mastery estimates using their data cutoff timestamps.
3. Identify content the learner has not previously attempted.
4. Prioritize skills with low or unrecorded mastery.
5. Evaluate prerequisite mastery before selecting eligible content.
6. Generate recommendations with reason codes and explanatory rationales.
7. Track completed recommendation outcomes using matching learner attempts.

### Recommendation reason codes

- `COLD_START_SKILL` — No recorded mastery estimate exists for the recommended skill.
- `LOW_SKILL_MASTERY` — Estimated mastery is below the configured threshold.
- `PREREQUISITES_SATISFIED` — The required prerequisite skills meet the mastery threshold.

The default mastery threshold is 60%, configurable through the `MASTERY_THRESHOLD` environment variable.

## 6. Project Setup

### Prerequisites

- Node.js
- PostgreSQL
- npm
- Git

### Clone the repository

```bash
git clone https://github.com/Sivasankar-tibirisetti/yottaflex-learning-engine.git
cd yottaflex-learning-engine
```

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create a local `.env` file in the project root:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=yottaflex_learning
DB_USER=your_postgres_username
DB_PASSWORD=your_postgres_password

SEED=20261022
ATTEMPTS_PER_LEARNER=50
MASTERY_THRESHOLD=60
TOTAL_LEARNING_PATHS=100
```

Replace the database credentials with your local PostgreSQL configuration.

The `.env` file contains local configuration and should not be committed to Git.

## 7. Data Generation Pipeline

Run the scripts in the appropriate dependency order.

| Step | Command | Purpose |
|---|---|---|
| 1 | `npm run test:db` | Verify database connectivity |
| 2 | `npm run generate:master` | Generate master data |
| 3 | `npm run seed:content` | Insert sample learning content |
| 4 | `npm run generate:attempts` | Generate learner attempts |
| 5 | `npm run calculate:mastery` | Calculate historical mastery |
| 6 | `npm run generate:recommendations` | Generate recommendations |
| 7 | `npm run generate:learning-paths` | Generate learning paths and steps |

**Important:** Generation scripts write to PostgreSQL. Review their upsert, conflict-handling and transaction behavior before rerunning them against an existing dataset.

The attempt generator uses `ATTEMPTS_PER_LEARNER` to control the number of attempts per learner. A value of 50 targets approximately 500,000 attempts for 10,000 learners.

The master-data generator uses a fixed seed (`20261022`) for its deterministic synthetic generation. Other generated timestamps and recommendation identifiers may depend on execution time, so the complete database should not be described as byte-for-byte reproducible without additional controls.

## 8. Validation and Edge Cases

The project includes validation scripts for five important scenarios.

| Edge case | Validation |
|---|---|
| Invalid attempt timestamp | Checks timestamp ordering constraints |
| Nonexistent skill mapping | Checks content-skill foreign-key integrity |
| Future mastery leakage | Checks that future attempts do not affect historical mastery |
| Learning-path repetition | Detects repeated content without intervening progress |
| Prerequisite violation | Checks prerequisite mastery before recommendation eligibility |

### Run individual validators

```bash
npm run validate:attempts
npm run validate:content-skills
npm run validate:future-mastery
npm run validate:path-loops
npm run validate:prerequisites
```

### Run the complete test suite

```bash
npm test
```

The current recorded ground-truth validation result is:

- Total edge cases: 5
- Detected: 5
- Missed: 0

The future-mastery and learning-path tests use synthetic test records and transaction rollback to avoid retaining temporary test activity.

## 9. Recommendation Outcome Tracking

The outcome handler associates a completed learner attempt with its corresponding recommendation.

It checks that:

- The recommendation exists.
- Its status allows outcome recording (`recommended` or `accepted`).
- The attempt exists and belongs to the same learner.
- The attempt is for the recommended content.
- The attempt has a completed status.

The recommendation and outcome association are updated within a database transaction.

## 10. Current Scope and Limitations

- This repository currently implements a backend data-processing and recommendation workflow; it does not include a learner-facing frontend.
- The dataset is synthetic and is not real learner or production platform data.
- Passing the implemented validators demonstrates the tested database and business-rule conditions, not complete production recommendation quality.
- The current recommendation implementation uses a configurable mastery threshold and prerequisite checks; it is not a trained machine-learning recommendation model.
- Recommendation quality, learner engagement and learning outcomes would require further evaluation using appropriate real-world or independently validated data.
- Full end-to-end reproducibility requires controlling generated identifiers, timestamps, environment configuration and database state.

## 11. Repository Structure

```text
yottaflex-learning-engine/
│
├── src/
│   ├── config/
│   │   └── db.js
│   ├── generators/
│   │   ├── generateMasterData.js
│   │   ├── generateAttempts.js
│   │   ├── calculateMastery.js
│   │   ├── generateRecommendations.js
│   │   ├── generateLearningPaths.js
│   │   ├── recordRecommendationOutcome.js
│   │   ├── seedMasterData.js
│   │   └── seedLearningContent.js
│   ├── validators/
│   │   ├── validateAttempts.js
│   │   ├── validateContentSkills.js
│   │   ├── validateFutureAttemptMastery.js
│   │   ├── validateLearningPathLoops.js
│   │   └── validatePrerequisites.js
│   └── test-db.js
│
├── sql/
│   └── schema-inventory.sql
│
├── .env
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

## 12. AI Assistance

AI tools assisted during development, code review and debugging. Database operations, implementation decisions and validation results were reviewed during project development.
