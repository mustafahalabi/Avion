-- Additive: company-level default execution agent type (MUS-264).
-- Null (or an unrecognized value) falls back to "claude_code".
ALTER TABLE "CompanySettings" ADD COLUMN "defaultAgentType" TEXT;
