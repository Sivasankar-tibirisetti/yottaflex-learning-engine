# Data Dictionary — YottaFlex Learning Engine

## 1. Overview

The YottaFlex Learning Engine uses a PostgreSQL relational database to manage learners, courses, skills, learning content, assessment attempts, mastery estimates, recommendations and learning paths.

The database contains 13 core tables.

## 2. Table Descriptions

| Table | Purpose |
|---|---|
| `learners` | Stores learner master records and learner lifecycle status. |
| `courses` | Stores available courses and their status. |
| `skills` | Stores the skills used for learning and assessment. |
| `skill_prerequisites` | Defines prerequisite relationships between skills. |
| `content_items` | Stores learning resources such as lessons, quizzes, videos, readings and coding exercises. |
| `content_skills` | Maps learning content to the skills it teaches or assesses, including relevance weights. |
| `attempts` | Stores learner attempts against learning content, including timestamps, scores and attempt status. |
| `assessment_results` | Stores assessment outcomes associated with attempts. |
| `mastery_estimates` | Stores calculated learner mastery estimates for skills at a specified cutoff time. |
| `recommendations` | Stores recommended learning content, reason codes, rationale and recommendation outcomes. |
| `learning_paths` | Stores learner-specific learning paths and their lifecycle status. |
| `learning_path_steps` | Stores ordered content steps within learning paths and their completion status. |
| `ground_truth` | Stores labelled synthetic edge cases and their expected validation outcomes. |

## 3. Primary and Foreign Key Relationships

- `skill_prerequisites.skill_id` and `skill_prerequisites.prerequisite_skill_id` reference `skills.skill_id`.
- `content_items.course_id` references `courses.course_id` and is optional.
- `content_skills.content_item_id` references `content_items.content_item_id`.
- `content_skills.skill_id` references `skills.skill_id`.
- `attempts.learner_id` references `learners.learner_id`.
- `attempts.content_item_id` references `content_items.content_item_id`.
- `assessment_results.attempt_id` references `attempts.attempt_id`.
- `mastery_estimates.learner_id` references `learners.learner_id`.
- `mastery_estimates.skill_id` references `skills.skill_id`.
- `recommendations.learner_id` references `learners.learner_id`.
- `recommendations.content_item_id` references `content_items.content_item_id`.
- `recommendations.learning_path_id` optionally references `learning_paths.learning_path_id`.
- `recommendations.outcome_attempt_id` optionally references `attempts.attempt_id`.
- `learning_paths.learner_id` references `learners.learner_id`.
- `learning_paths.course_id` references `courses.course_id`.
- `learning_path_steps.learning_path_id` references `learning_paths.learning_path_id`.
- `learning_path_steps.content_item_id` references `content_items.content_item_id`.

## 4. Important Constraints and Validation Rules

- Attempt numbers must be positive.
- Attempt scores must be between 0 and 100 when provided.
- An attempt's completion timestamp cannot precede its start timestamp.
- Assessment scores must be between 0 and 100.
- Content difficulty must be between 1 and 5.
- Content estimated duration must be positive when provided.
- Content-skill relevance weights must be greater than 0 and at most 1.
- A skill cannot be its own prerequisite.
- Learning path step numbers are unique within a learning path.
- Recommendation lifecycle states are restricted to the defined status values.
- A completed recommendation requires an associated outcome attempt.
- Learning path lifecycle states and completion timestamps are constrained.

## 5. Identifier Conventions

Examples of generated identifiers:

| Entity | Example |
|---|---|
| Learner | `LRN-000001` |
| Course | `CRS-000001` |
| Skill | `SKL-000001` |
| Content item | `CNT-000001` |
| Attempt | `ATT-LRN-000001-000001` |
| Learning path | `PATH-2026-000001` |

## 6. Database Inventory

The file `sql/schema-inventory.sql` contains metadata extracted from the connected PostgreSQL database, including column types, nullability, defaults and constraints.

**Important:** This is an inventory document, not an executable database restoration or table-creation script.

For exact column definitions and constraints, refer to `sql/schema-inventory.sql` and the database schema.

## 7. Known Schema Limitations

The current implementation has areas that could be strengthened:

- Prerequisite and content-skill relationships do not currently have explicit effective-date fields.
- Recommendation changes are not maintained in a separate recommendation event-history table.
- Mastery snapshot uniqueness and historical versioning could be strengthened.
- `ground_truth` uses entity type and entity ID fields for case references; these do not provide a conventional foreign key for every entity type.

These are documented design limitations rather than claims of functionality that is not currently implemented.

## 9. Field-Level Schema Reference

This section is generated from PostgreSQL information_schema
and pg_constraint metadata. It reflects the connected database
schema at the time of generation.


### assessment_results

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `assessment_result_id` | character varying | No | `—` |
| `attempt_id` | character varying | No | `—` |
| `score` | numeric | No | `—` |
| `passed` | boolean | No | `—` |
| `assessed_at` | timestamp with time zone | No | `—` |
| `grading_version` | character varying | No | `—` |
| `created_at` | timestamp with time zone | No | `CURRENT_TIMESTAMP` |

**Constraints**

- **CHECK** (`assessment_results_score_check`): `CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric)))`
- **FOREIGN KEY** (`assessment_results_attempt_id_fkey`): `FOREIGN KEY (attempt_id) REFERENCES attempts(attempt_id)`
- **PRIMARY KEY** (`assessment_results_pkey`): `PRIMARY KEY (assessment_result_id)`
- **UNIQUE** (`assessment_results_attempt_id_key`): `UNIQUE (attempt_id)`


### attempts

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `attempt_id` | character varying | No | `—` |
| `learner_id` | character varying | No | `—` |
| `content_item_id` | character varying | No | `—` |
| `attempt_number` | integer | No | `—` |
| `started_at` | timestamp with time zone | No | `—` |
| `completed_at` | timestamp with time zone | Yes | `—` |
| `score` | numeric | Yes | `—` |
| `attempt_status` | character varying | No | `—` |
| `created_at` | timestamp with time zone | No | `CURRENT_TIMESTAMP` |

**Constraints**

- **CHECK** (`attempts_attempt_number_check`): `CHECK ((attempt_number > 0))`
- **CHECK** (`attempts_attempt_status_check`): `CHECK (((attempt_status)::text = ANY ((ARRAY['in_progress'::character varying, 'completed'::character varying, 'abandoned'::character varying])::text[])))`
- **CHECK** (`attempts_check`): `CHECK (((completed_at IS NULL) OR (completed_at >= started_at)))`
- **CHECK** (`attempts_score_check`): `CHECK (((score IS NULL) OR ((score >= (0)::numeric) AND (score <= (100)::numeric))))`
- **FOREIGN KEY** (`attempts_content_item_id_fkey`): `FOREIGN KEY (content_item_id) REFERENCES content_items(content_item_id)`
- **FOREIGN KEY** (`attempts_learner_id_fkey`): `FOREIGN KEY (learner_id) REFERENCES learners(learner_id)`
- **PRIMARY KEY** (`attempts_pkey`): `PRIMARY KEY (attempt_id)`
- **UNIQUE** (`attempts_learner_id_content_item_id_attempt_number_key`): `UNIQUE (learner_id, content_item_id, attempt_number)`


### content_items

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `content_item_id` | character varying | No | `—` |
| `course_id` | character varying | Yes | `—` |
| `title` | character varying | No | `—` |
| `content_type` | character varying | No | `—` |
| `difficulty` | smallint | No | `—` |
| `estimated_minutes` | integer | Yes | `—` |
| `content_status` | character varying | No | `'active'::character varying` |
| `created_at` | timestamp with time zone | No | `CURRENT_TIMESTAMP` |

**Constraints**

- **CHECK** (`content_items_content_item_id_check`): `CHECK (((content_item_id)::text ~ '^CNT-[0-9]{6}$'::text))`
- **CHECK** (`content_items_content_status_check`): `CHECK (((content_status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'retired'::character varying])::text[])))`
- **CHECK** (`content_items_content_type_check`): `CHECK (((content_type)::text = ANY ((ARRAY['lesson'::character varying, 'quiz'::character varying, 'coding_exercise'::character varying, 'project'::character varying, 'video'::character varying, 'reading'::character varying])::text[])))`
- **CHECK** (`content_items_difficulty_check`): `CHECK (((difficulty >= 1) AND (difficulty <= 5)))`
- **CHECK** (`content_items_estimated_minutes_check`): `CHECK (((estimated_minutes IS NULL) OR (estimated_minutes > 0)))`
- **FOREIGN KEY** (`content_items_course_id_fkey`): `FOREIGN KEY (course_id) REFERENCES courses(course_id)`
- **PRIMARY KEY** (`content_items_pkey`): `PRIMARY KEY (content_item_id)`


### content_skills

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `content_item_id` | character varying | No | `—` |
| `skill_id` | character varying | No | `—` |
| `relevance_weight` | numeric | No | `1.0` |

**Constraints**

- **CHECK** (`content_skills_relevance_weight_check`): `CHECK (((relevance_weight > (0)::numeric) AND (relevance_weight <= (1)::numeric)))`
- **FOREIGN KEY** (`content_skills_content_item_id_fkey`): `FOREIGN KEY (content_item_id) REFERENCES content_items(content_item_id)`
- **FOREIGN KEY** (`content_skills_skill_id_fkey`): `FOREIGN KEY (skill_id) REFERENCES skills(skill_id)`
- **PRIMARY KEY** (`content_skills_pkey`): `PRIMARY KEY (content_item_id, skill_id)`


### courses

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `course_id` | character varying | No | `—` |
| `course_name` | character varying | No | `—` |
| `description` | text | Yes | `—` |
| `course_status` | character varying | No | `'active'::character varying` |
| `created_at` | timestamp with time zone | No | `CURRENT_TIMESTAMP` |

**Constraints**

- **CHECK** (`courses_course_id_check`): `CHECK (((course_id)::text ~ '^CRS-[0-9]{6}$'::text))`
- **CHECK** (`courses_course_status_check`): `CHECK (((course_status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'archived'::character varying])::text[])))`
- **PRIMARY KEY** (`courses_pkey`): `PRIMARY KEY (course_id)`


### ground_truth

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `ground_truth_id` | bigint | No | `—` |
| `case_id` | character varying | No | `—` |
| `case_type` | character varying | No | `—` |
| `entity_type` | character varying | No | `—` |
| `entity_id` | character varying | No | `—` |
| `expected_violation` | boolean | No | `true` |
| `description` | text | No | `—` |
| `validation_status` | character varying | No | `'pending'::character varying` |
| `created_at` | timestamp with time zone | No | `now()` |

**Constraints**

- **CHECK** (`ground_truth_case_type_check`): `CHECK (((case_type)::text = ANY ((ARRAY['prerequisite_violation'::character varying, 'invalid_attempt_timestamp'::character varying, 'invalid_content_skill_mapping'::character varying, 'future_attempt_mastery'::character varying, 'learning_path_loop'::character varying])::text[])))`
- **CHECK** (`ground_truth_validation_status_check`): `CHECK (((validation_status)::text = ANY ((ARRAY['pending'::character varying, 'detected'::character varying, 'missed'::character varying])::text[])))`
- **PRIMARY KEY** (`ground_truth_pkey`): `PRIMARY KEY (ground_truth_id)`
- **UNIQUE** (`ground_truth_case_id_key`): `UNIQUE (case_id)`


### learners

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `learner_id` | character varying | No | `—` |
| `email` | character varying | Yes | `—` |
| `display_name` | character varying | No | `—` |
| `learner_status` | character varying | No | `'active'::character varying` |
| `created_at` | timestamp with time zone | No | `CURRENT_TIMESTAMP` |

**Constraints**

- **CHECK** (`learners_learner_id_check`): `CHECK (((learner_id)::text ~ '^LRN-[0-9]{6}$'::text))`
- **CHECK** (`learners_learner_status_check`): `CHECK (((learner_status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying])::text[])))`
- **PRIMARY KEY** (`learners_pkey`): `PRIMARY KEY (learner_id)`
- **UNIQUE** (`learners_email_key`): `UNIQUE (email)`


### learning_path_steps

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `step_id` | bigint | No | `—` |
| `learning_path_id` | character varying | No | `—` |
| `step_number` | integer | No | `—` |
| `content_item_id` | character varying | No | `—` |
| `step_status` | character varying | No | `'pending'::character varying` |
| `completed_at` | timestamp with time zone | Yes | `—` |
| `created_at` | timestamp with time zone | No | `now()` |

**Constraints**

- **CHECK** (`learning_path_steps_step_number_check`): `CHECK ((step_number > 0))`
- **CHECK** (`learning_path_steps_step_status_check`): `CHECK (((step_status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying])::text[])))`
- **CHECK** (`step_completion_consistency`): `CHECK (((((step_status)::text = 'completed'::text) AND (completed_at IS NOT NULL)) OR (((step_status)::text <> 'completed'::text) AND (completed_at IS NULL))))`
- **FOREIGN KEY** (`learning_path_steps_content_item_id_fkey`): `FOREIGN KEY (content_item_id) REFERENCES content_items(content_item_id)`
- **FOREIGN KEY** (`learning_path_steps_learning_path_id_fkey`): `FOREIGN KEY (learning_path_id) REFERENCES learning_paths(learning_path_id) ON DELETE CASCADE`
- **PRIMARY KEY** (`learning_path_steps_pkey`): `PRIMARY KEY (step_id)`
- **UNIQUE** (`unique_path_step`): `UNIQUE (learning_path_id, step_number)`


### learning_paths

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `learning_path_id` | character varying | No | `—` |
| `learner_id` | character varying | No | `—` |
| `course_id` | character varying | No | `—` |
| `path_status` | character varying | No | `'active'::character varying` |
| `started_at` | timestamp with time zone | No | `—` |
| `completed_at` | timestamp with time zone | Yes | `—` |
| `created_at` | timestamp with time zone | No | `CURRENT_TIMESTAMP` |

**Constraints**

- **CHECK** (`learning_paths_check`): `CHECK (((completed_at IS NULL) OR (completed_at >= started_at)))`
- **CHECK** (`learning_paths_learning_path_id_check`): `CHECK (((learning_path_id)::text ~ '^PATH-[0-9]{4}-[0-9]{6}$'::text))`
- **CHECK** (`learning_paths_path_status_check`): `CHECK (((path_status)::text = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'paused'::character varying, 'cancelled'::character varying])::text[])))`
- **FOREIGN KEY** (`learning_paths_course_id_fkey`): `FOREIGN KEY (course_id) REFERENCES courses(course_id)`
- **FOREIGN KEY** (`learning_paths_learner_id_fkey`): `FOREIGN KEY (learner_id) REFERENCES learners(learner_id)`
- **PRIMARY KEY** (`learning_paths_pkey`): `PRIMARY KEY (learning_path_id)`


### mastery_estimates

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `mastery_estimate_id` | bigint | No | `—` |
| `learner_id` | character varying | No | `—` |
| `skill_id` | character varying | No | `—` |
| `attempts_count` | integer | No | `—` |
| `mastery_score` | numeric | Yes | `—` |
| `calculated_at` | timestamp with time zone | No | `now()` |
| `data_cutoff_at` | timestamp with time zone | No | `—` |
| `calculation_version` | character varying | No | `'v1'::character varying` |

**Constraints**

- **CHECK** (`mastery_estimates_attempts_count_check`): `CHECK ((attempts_count >= 0))`
- **CHECK** (`mastery_estimates_check`): `CHECK ((data_cutoff_at <= calculated_at))`
- **CHECK** (`mastery_estimates_mastery_score_check`): `CHECK (((mastery_score >= (0)::numeric) AND (mastery_score <= (100)::numeric)))`
- **FOREIGN KEY** (`mastery_estimates_learner_id_fkey`): `FOREIGN KEY (learner_id) REFERENCES learners(learner_id)`
- **FOREIGN KEY** (`mastery_estimates_skill_id_fkey`): `FOREIGN KEY (skill_id) REFERENCES skills(skill_id)`
- **PRIMARY KEY** (`mastery_estimates_pkey`): `PRIMARY KEY (mastery_estimate_id)`


### recommendations

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `recommendation_id` | character varying | No | `—` |
| `learner_id` | character varying | No | `—` |
| `learning_path_id` | character varying | Yes | `—` |
| `content_item_id` | character varying | No | `—` |
| `generated_at` | timestamp with time zone | No | `—` |
| `mastery_at_generation` | numeric | Yes | `—` |
| `reason_codes` | jsonb | No | `'[]'::jsonb` |
| `rationale` | text | No | `—` |
| `recommendation_status` | character varying | No | `'recommended'::character varying` |
| `outcome_attempt_id` | character varying | Yes | `—` |
| `created_at` | timestamp with time zone | No | `CURRENT_TIMESTAMP` |

**Constraints**

- **CHECK** (`recommendations_check`): `CHECK ((((recommendation_status)::text <> 'completed'::text) OR (outcome_attempt_id IS NOT NULL)))`
- **CHECK** (`recommendations_mastery_at_generation_check`): `CHECK (((mastery_at_generation IS NULL) OR ((mastery_at_generation >= (0)::numeric) AND (mastery_at_generation <= (100)::numeric))))`
- **CHECK** (`recommendations_reason_codes_check`): `CHECK ((jsonb_typeof(reason_codes) = 'array'::text))`
- **CHECK** (`recommendations_recommendation_status_check`): `CHECK (((recommendation_status)::text = ANY ((ARRAY['recommended'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'completed'::character varying, 'expired'::character varying])::text[])))`
- **FOREIGN KEY** (`recommendations_content_item_id_fkey`): `FOREIGN KEY (content_item_id) REFERENCES content_items(content_item_id)`
- **FOREIGN KEY** (`recommendations_learner_id_fkey`): `FOREIGN KEY (learner_id) REFERENCES learners(learner_id)`
- **FOREIGN KEY** (`recommendations_learning_path_id_fkey`): `FOREIGN KEY (learning_path_id) REFERENCES learning_paths(learning_path_id)`
- **FOREIGN KEY** (`recommendations_outcome_attempt_id_fkey`): `FOREIGN KEY (outcome_attempt_id) REFERENCES attempts(attempt_id)`
- **PRIMARY KEY** (`recommendations_pkey`): `PRIMARY KEY (recommendation_id)`


### skill_prerequisites

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `skill_id` | character varying | No | `—` |
| `prerequisite_skill_id` | character varying | No | `—` |
| `created_at` | timestamp with time zone | No | `CURRENT_TIMESTAMP` |

**Constraints**

- **CHECK** (`skill_prerequisites_check`): `CHECK (((skill_id)::text <> (prerequisite_skill_id)::text))`
- **FOREIGN KEY** (`skill_prerequisites_prerequisite_skill_id_fkey`): `FOREIGN KEY (prerequisite_skill_id) REFERENCES skills(skill_id)`
- **FOREIGN KEY** (`skill_prerequisites_skill_id_fkey`): `FOREIGN KEY (skill_id) REFERENCES skills(skill_id)`
- **PRIMARY KEY** (`skill_prerequisites_pkey`): `PRIMARY KEY (skill_id, prerequisite_skill_id)`


### skills

| Column | PostgreSQL type | Nullable | Default |
|---|---|---|---|
| `skill_id` | character varying | No | `—` |
| `skill_name` | character varying | No | `—` |
| `description` | text | Yes | `—` |
| `created_at` | timestamp with time zone | No | `CURRENT_TIMESTAMP` |

**Constraints**

- **CHECK** (`skills_skill_id_check`): `CHECK (((skill_id)::text ~ '^SKL-[0-9]{6}$'::text))`
- **PRIMARY KEY** (`skills_pkey`): `PRIMARY KEY (skill_id)`
- **UNIQUE** (`skills_skill_name_key`): `UNIQUE (skill_name)`
