--
-- PostgreSQL database dump
--

\restrict 8rCf0RDcvRMu6JmltFo6pwKOkJLRL77uWJEa07beOH7ajGtWkIGWKq1ssI58n5E

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assessment_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_results (
    assessment_result_id character varying(30) NOT NULL,
    attempt_id character varying(60) NOT NULL,
    score numeric(5,2) NOT NULL,
    passed boolean NOT NULL,
    assessed_at timestamp with time zone NOT NULL,
    grading_version character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT assessment_results_score_check CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric)))
);


--
-- Name: attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attempts (
    attempt_id character varying(60) NOT NULL,
    learner_id character varying(20) NOT NULL,
    content_item_id character varying(20) NOT NULL,
    attempt_number integer NOT NULL,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    score numeric(5,2),
    attempt_status character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT attempts_attempt_number_check CHECK ((attempt_number > 0)),
    CONSTRAINT attempts_attempt_status_check CHECK (((attempt_status)::text = ANY ((ARRAY['in_progress'::character varying, 'completed'::character varying, 'abandoned'::character varying])::text[]))),
    CONSTRAINT attempts_check CHECK (((completed_at IS NULL) OR (completed_at >= started_at))),
    CONSTRAINT attempts_score_check CHECK (((score IS NULL) OR ((score >= (0)::numeric) AND (score <= (100)::numeric))))
);


--
-- Name: content_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_items (
    content_item_id character varying(20) NOT NULL,
    course_id character varying(20),
    title character varying(200) NOT NULL,
    content_type character varying(30) NOT NULL,
    difficulty smallint NOT NULL,
    estimated_minutes integer,
    content_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT content_items_content_item_id_check CHECK (((content_item_id)::text ~ '^CNT-[0-9]{6}$'::text)),
    CONSTRAINT content_items_content_status_check CHECK (((content_status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'retired'::character varying])::text[]))),
    CONSTRAINT content_items_content_type_check CHECK (((content_type)::text = ANY ((ARRAY['lesson'::character varying, 'quiz'::character varying, 'coding_exercise'::character varying, 'project'::character varying, 'video'::character varying, 'reading'::character varying])::text[]))),
    CONSTRAINT content_items_difficulty_check CHECK (((difficulty >= 1) AND (difficulty <= 5))),
    CONSTRAINT content_items_estimated_minutes_check CHECK (((estimated_minutes IS NULL) OR (estimated_minutes > 0)))
);


--
-- Name: content_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_skills (
    content_item_id character varying(20) NOT NULL,
    skill_id character varying(20) NOT NULL,
    relevance_weight numeric(5,4) DEFAULT 1.0 NOT NULL,
    CONSTRAINT content_skills_relevance_weight_check CHECK (((relevance_weight > (0)::numeric) AND (relevance_weight <= (1)::numeric)))
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    course_id character varying(20) NOT NULL,
    course_name character varying(150) NOT NULL,
    description text,
    course_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT courses_course_id_check CHECK (((course_id)::text ~ '^CRS-[0-9]{6}$'::text)),
    CONSTRAINT courses_course_status_check CHECK (((course_status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: ground_truth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ground_truth (
    ground_truth_id bigint NOT NULL,
    case_id character varying(50) NOT NULL,
    case_type character varying(60) NOT NULL,
    entity_type character varying(40) NOT NULL,
    entity_id character varying(100) NOT NULL,
    expected_violation boolean DEFAULT true NOT NULL,
    description text NOT NULL,
    validation_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ground_truth_case_type_check CHECK (((case_type)::text = ANY ((ARRAY['prerequisite_violation'::character varying, 'invalid_attempt_timestamp'::character varying, 'invalid_content_skill_mapping'::character varying, 'future_attempt_mastery'::character varying, 'learning_path_loop'::character varying])::text[]))),
    CONSTRAINT ground_truth_validation_status_check CHECK (((validation_status)::text = ANY ((ARRAY['pending'::character varying, 'detected'::character varying, 'missed'::character varying])::text[])))
);


--
-- Name: ground_truth_ground_truth_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ground_truth ALTER COLUMN ground_truth_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ground_truth_ground_truth_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: learners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learners (
    learner_id character varying(20) NOT NULL,
    email character varying(255),
    display_name character varying(100) NOT NULL,
    learner_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT learners_learner_id_check CHECK (((learner_id)::text ~ '^LRN-[0-9]{6}$'::text)),
    CONSTRAINT learners_learner_status_check CHECK (((learner_status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying])::text[])))
);


--
-- Name: learning_path_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_path_steps (
    step_id bigint NOT NULL,
    learning_path_id character varying(30) NOT NULL,
    step_number integer NOT NULL,
    content_item_id character varying(20) NOT NULL,
    step_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT learning_path_steps_step_number_check CHECK ((step_number > 0)),
    CONSTRAINT learning_path_steps_step_status_check CHECK (((step_status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying])::text[]))),
    CONSTRAINT step_completion_consistency CHECK (((((step_status)::text = 'completed'::text) AND (completed_at IS NOT NULL)) OR (((step_status)::text <> 'completed'::text) AND (completed_at IS NULL))))
);


--
-- Name: learning_path_steps_step_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.learning_path_steps ALTER COLUMN step_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.learning_path_steps_step_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: learning_paths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_paths (
    learning_path_id character varying(30) NOT NULL,
    learner_id character varying(20) NOT NULL,
    course_id character varying(20) NOT NULL,
    path_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT learning_paths_check CHECK (((completed_at IS NULL) OR (completed_at >= started_at))),
    CONSTRAINT learning_paths_learning_path_id_check CHECK (((learning_path_id)::text ~ '^PATH-[0-9]{4}-[0-9]{6}$'::text)),
    CONSTRAINT learning_paths_path_status_check CHECK (((path_status)::text = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'paused'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: mastery_estimates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mastery_estimates (
    mastery_estimate_id bigint NOT NULL,
    learner_id character varying(20) NOT NULL,
    skill_id character varying(20) NOT NULL,
    attempts_count integer NOT NULL,
    mastery_score numeric(5,2),
    calculated_at timestamp with time zone DEFAULT now() NOT NULL,
    data_cutoff_at timestamp with time zone NOT NULL,
    calculation_version character varying(30) DEFAULT 'v1'::character varying NOT NULL,
    CONSTRAINT mastery_estimates_attempts_count_check CHECK ((attempts_count >= 0)),
    CONSTRAINT mastery_estimates_check CHECK ((data_cutoff_at <= calculated_at)),
    CONSTRAINT mastery_estimates_mastery_score_check CHECK (((mastery_score >= (0)::numeric) AND (mastery_score <= (100)::numeric)))
);


--
-- Name: mastery_estimates_mastery_estimate_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.mastery_estimates ALTER COLUMN mastery_estimate_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.mastery_estimates_mastery_estimate_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommendations (
    recommendation_id character varying(30) NOT NULL,
    learner_id character varying(20) NOT NULL,
    learning_path_id character varying(30),
    content_item_id character varying(20) NOT NULL,
    generated_at timestamp with time zone NOT NULL,
    mastery_at_generation numeric(5,2),
    reason_codes jsonb DEFAULT '[]'::jsonb NOT NULL,
    rationale text NOT NULL,
    recommendation_status character varying(20) DEFAULT 'recommended'::character varying NOT NULL,
    outcome_attempt_id character varying(60),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT recommendations_check CHECK ((((recommendation_status)::text <> 'completed'::text) OR (outcome_attempt_id IS NOT NULL))),
    CONSTRAINT recommendations_mastery_at_generation_check CHECK (((mastery_at_generation IS NULL) OR ((mastery_at_generation >= (0)::numeric) AND (mastery_at_generation <= (100)::numeric)))),
    CONSTRAINT recommendations_reason_codes_check CHECK ((jsonb_typeof(reason_codes) = 'array'::text)),
    CONSTRAINT recommendations_recommendation_status_check CHECK (((recommendation_status)::text = ANY ((ARRAY['recommended'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'completed'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: skill_prerequisites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_prerequisites (
    skill_id character varying(20) NOT NULL,
    prerequisite_skill_id character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT skill_prerequisites_check CHECK (((skill_id)::text <> (prerequisite_skill_id)::text))
);


--
-- Name: skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skills (
    skill_id character varying(20) NOT NULL,
    skill_name character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT skills_skill_id_check CHECK (((skill_id)::text ~ '^SKL-[0-9]{6}$'::text))
);


--
-- Name: assessment_results assessment_results_attempt_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_results
    ADD CONSTRAINT assessment_results_attempt_id_key UNIQUE (attempt_id);


--
-- Name: assessment_results assessment_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_results
    ADD CONSTRAINT assessment_results_pkey PRIMARY KEY (assessment_result_id);


--
-- Name: attempts attempts_learner_id_content_item_id_attempt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_learner_id_content_item_id_attempt_number_key UNIQUE (learner_id, content_item_id, attempt_number);


--
-- Name: attempts attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_pkey PRIMARY KEY (attempt_id);


--
-- Name: content_items content_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_items
    ADD CONSTRAINT content_items_pkey PRIMARY KEY (content_item_id);


--
-- Name: content_skills content_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_skills
    ADD CONSTRAINT content_skills_pkey PRIMARY KEY (content_item_id, skill_id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (course_id);


--
-- Name: ground_truth ground_truth_case_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ground_truth
    ADD CONSTRAINT ground_truth_case_id_key UNIQUE (case_id);


--
-- Name: ground_truth ground_truth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ground_truth
    ADD CONSTRAINT ground_truth_pkey PRIMARY KEY (ground_truth_id);


--
-- Name: learners learners_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learners
    ADD CONSTRAINT learners_email_key UNIQUE (email);


--
-- Name: learners learners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learners
    ADD CONSTRAINT learners_pkey PRIMARY KEY (learner_id);


--
-- Name: learning_path_steps learning_path_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_path_steps
    ADD CONSTRAINT learning_path_steps_pkey PRIMARY KEY (step_id);


--
-- Name: learning_paths learning_paths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_paths
    ADD CONSTRAINT learning_paths_pkey PRIMARY KEY (learning_path_id);


--
-- Name: mastery_estimates mastery_estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastery_estimates
    ADD CONSTRAINT mastery_estimates_pkey PRIMARY KEY (mastery_estimate_id);


--
-- Name: recommendations recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_pkey PRIMARY KEY (recommendation_id);


--
-- Name: skill_prerequisites skill_prerequisites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_prerequisites
    ADD CONSTRAINT skill_prerequisites_pkey PRIMARY KEY (skill_id, prerequisite_skill_id);


--
-- Name: skills skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (skill_id);


--
-- Name: skills skills_skill_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_skill_name_key UNIQUE (skill_name);


--
-- Name: learning_path_steps unique_path_step; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_path_steps
    ADD CONSTRAINT unique_path_step UNIQUE (learning_path_id, step_number);


--
-- Name: idx_attempts_content; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempts_content ON public.attempts USING btree (content_item_id);


--
-- Name: idx_attempts_learner_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempts_learner_time ON public.attempts USING btree (learner_id, started_at);


--
-- Name: idx_content_skills_skill; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_skills_skill ON public.content_skills USING btree (skill_id);


--
-- Name: idx_learning_path_steps_content; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_path_steps_content ON public.learning_path_steps USING btree (content_item_id);


--
-- Name: idx_learning_paths_learner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_paths_learner ON public.learning_paths USING btree (learner_id);


--
-- Name: idx_mastery_estimates_learner_skill_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mastery_estimates_learner_skill_time ON public.mastery_estimates USING btree (learner_id, skill_id, calculated_at DESC);


--
-- Name: idx_recommendations_learner_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recommendations_learner_time ON public.recommendations USING btree (learner_id, generated_at);


--
-- Name: assessment_results assessment_results_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_results
    ADD CONSTRAINT assessment_results_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.attempts(attempt_id);


--
-- Name: attempts attempts_content_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.content_items(content_item_id);


--
-- Name: attempts attempts_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(learner_id);


--
-- Name: content_items content_items_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_items
    ADD CONSTRAINT content_items_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id);


--
-- Name: content_skills content_skills_content_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_skills
    ADD CONSTRAINT content_skills_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.content_items(content_item_id);


--
-- Name: content_skills content_skills_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_skills
    ADD CONSTRAINT content_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(skill_id);


--
-- Name: learning_path_steps learning_path_steps_content_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_path_steps
    ADD CONSTRAINT learning_path_steps_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.content_items(content_item_id);


--
-- Name: learning_path_steps learning_path_steps_learning_path_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_path_steps
    ADD CONSTRAINT learning_path_steps_learning_path_id_fkey FOREIGN KEY (learning_path_id) REFERENCES public.learning_paths(learning_path_id) ON DELETE CASCADE;


--
-- Name: learning_paths learning_paths_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_paths
    ADD CONSTRAINT learning_paths_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(course_id);


--
-- Name: learning_paths learning_paths_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_paths
    ADD CONSTRAINT learning_paths_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(learner_id);


--
-- Name: mastery_estimates mastery_estimates_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastery_estimates
    ADD CONSTRAINT mastery_estimates_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(learner_id);


--
-- Name: mastery_estimates mastery_estimates_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mastery_estimates
    ADD CONSTRAINT mastery_estimates_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(skill_id);


--
-- Name: recommendations recommendations_content_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.content_items(content_item_id);


--
-- Name: recommendations recommendations_learner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_learner_id_fkey FOREIGN KEY (learner_id) REFERENCES public.learners(learner_id);


--
-- Name: recommendations recommendations_learning_path_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_learning_path_id_fkey FOREIGN KEY (learning_path_id) REFERENCES public.learning_paths(learning_path_id);


--
-- Name: recommendations recommendations_outcome_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommendations
    ADD CONSTRAINT recommendations_outcome_attempt_id_fkey FOREIGN KEY (outcome_attempt_id) REFERENCES public.attempts(attempt_id);


--
-- Name: skill_prerequisites skill_prerequisites_prerequisite_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_prerequisites
    ADD CONSTRAINT skill_prerequisites_prerequisite_skill_id_fkey FOREIGN KEY (prerequisite_skill_id) REFERENCES public.skills(skill_id);


--
-- Name: skill_prerequisites skill_prerequisites_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_prerequisites
    ADD CONSTRAINT skill_prerequisites_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(skill_id);


--
-- PostgreSQL database dump complete
--

\unrestrict 8rCf0RDcvRMu6JmltFo6pwKOkJLRL77uWJEa07beOH7ajGtWkIGWKq1ssI58n5E
