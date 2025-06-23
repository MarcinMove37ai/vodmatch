-- AlterTable
ALTER TABLE "session_profiles" ADD COLUMN     "social_analysis_error" TEXT,
ADD COLUMN     "social_analysis_status" VARCHAR(20),
ADD COLUMN     "social_analyzed_at" TIMESTAMP(3),
ADD COLUMN     "social_posts" JSONB;
