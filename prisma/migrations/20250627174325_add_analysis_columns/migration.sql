-- AlterTable
ALTER TABLE "session_profiles" ADD COLUMN     "individual_analysis" JSONB;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "group_analysis" JSONB;
