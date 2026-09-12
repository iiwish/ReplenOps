ALTER TABLE "wecom_auth_challenges" DROP CONSTRAINT "wecom_auth_challenges_stage";
ALTER TABLE "wecom_auth_challenges" ADD CONSTRAINT "wecom_auth_challenges_stage" CHECK (
  ("stage" IN ('oauth', 'exchange') AND "subject_id" IS NULL) OR
  ("stage" = 'bind' AND "subject_id" IS NOT NULL)
);
