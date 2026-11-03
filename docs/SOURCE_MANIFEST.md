# Source Manifest — YottaFlex Learning Engine

## 1. Data Source

This project uses synthetically generated learning-platform data. No real learner personal information or proprietary external dataset is required by the current implementation.

The synthetic dataset is generated using Node.js scripts and stored in PostgreSQL.

## 2. Generation Configuration

| Parameter | Value |
|---|---|
| Database | PostgreSQL |
| Generation seed | `20261022` |
| Baseline learners | 10,000 |
| Courses | 50 |
| Skills | 500 |
| Learning content items | 2,000 |
| Skill prerequisite relationships | 662 |
| Content-skill mappings | 2,000 |
| Baseline target attempts | 500,000 |
| Attempts per learner | 50 |
| Learning paths | 100 |
| Steps per generated path | 3 |

The observed database contains 500,001 attempts. The additional record has not been conclusively attributed to a specific generation step and is disclosed rather than silently excluded.

## 3. Source Code and Responsibilities

| File | Responsibility |
|---|---|
| `src/generators/generateMasterData.js` | Generates learner, course, skill and content master data. |
| `src/generators/seedMasterData.js` | Inserts a small sample of master records. |
| `src/generators/seedLearningContent.js` | Inserts sample learning content and prerequisite data. |
| `src/generators/generateAttempts.js` | Generates synthetic learner attempts and assessment results. |
| `src/generators/calculateMastery.js` | Calculates historical learner-skill mastery estimates. |
| `src/generators/generateRecommendations.js` | Generates eligible learning-content recommendations. |
| `src/generators/generateLearningPaths.js` | Generates learner-specific learning paths and ordered steps. |
| `src/generators/recordRecommendationOutcome.js` | Records recommendation outcomes. |
| `src/generators/exportDataset.js` | Exports all database tables as CSV and labelled ground-truth records as JSON. |
| `src/generators/exportSchemaInventory.js` | Exports database schema metadata. |
| `src/validators/` | Contains validation scripts for identified edge cases.

## 4. Synthetic Data Characteristics

The generated data is designed to represent:

- Learners with different skill profiles.
- Courses and learning resources with different difficulty levels.
- Skill prerequisite relationships.
- Content-to-skill mappings.
- Repeated learner attempts over time.
- Assessment outcomes.
- Historical mastery estimates.
- Recommendation decisions and reason codes.
- Learning paths with ordered steps.
- Labelled edge cases for validation.

## 5. Reproducibility

The master-data and attempt-generation scripts use a configurable seed, with `20261022` as the documented seed.

The generation process also depends on configuration values and database state. Recommendation identifiers and runtime timestamps may vary between executions.

Therefore, identical complete database output across repeated executions has not been established. The fixed seed supports deterministic generation where implemented, but does not guarantee byte-for-byte reproducibility of every generated table.

## 6. External Data and Attribution

No external learner dataset is used by the current synthetic-data pipeline.

The project uses the listed local source-code generators and PostgreSQL database records as its data-generation sources.

## 7. Dataset Export Status

The repository includes exported dataset files:

- `data/exports/csv/` — 13 CSV files covering all database tables.
- `data/exports/json/ground_truth.json` — five labelled synthetic edge cases.
- `sql/schema.sql` — executable PostgreSQL schema.
- `sql/seed-data.dump` — compressed PostgreSQL data-only backup.
- `sql/schema-inventory.sql` — schema metadata inventory.

To regenerate the CSV and JSON exports from the connected PostgreSQL database, run:

```bash
npm run export:data
```

The export generator reads the database and does not modify its records. The exports reflect the database state at the time of generation.

The plain-text SQL data export is maintained locally and excluded from Git because of its size.


## 8. Data Safety

Database credentials are supplied through environment variables in `.env`.

The `.env` file is excluded through `.gitignore` and must not be committed to the public repository.
