-- Add usage tracking to AI responses (tokens/cost)
ALTER TABLE "ai_responses" ADD COLUMN "usage" JSONB;
