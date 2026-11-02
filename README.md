# YottaFlex Learning Engine

A Node.js and PostgreSQL learning recommendation engine that estimates learner skill mastery, considers prerequisites, recommends learning content, and tracks recommendation outcomes.

## Technology
- Node.js
- PostgreSQL
- JavaScript
- pg and dotenv

## Dataset
The recorded generation run contains 10,000 learners, 500 skills, 2,000 content items, 500,000 attempts, and 242,564 assessment results.

## Setup
1. Install Node.js and PostgreSQL.
2. Create a PostgreSQL database and configure the local `.env` file.
3. Install dependencies with `npm install`.
4. Run `npm run test:db` to check connectivity.

Required environment variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`.

## Pipeline
Run the seed and generation scripts in the order documented in the source code. Calculate mastery before generating recommendations. Review scripts before rerunning them because they may write database records.

## Validation
Validators cover attempt timestamps, content-skill mappings, historical mastery leakage, learning-path repetition, and prerequisite violations.

## Limitations
This repository currently contains a backend data-processing workflow, not a learner-facing frontend. Synthetic data and passing edge-case checks do not establish production recommendation quality.

## AI assistance
AI tools assisted development. The implementation and validation results should be reviewed before submission.

