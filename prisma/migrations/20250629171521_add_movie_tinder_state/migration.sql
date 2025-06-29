-- AlterTable
ALTER TABLE "session_profiles" ADD COLUMN     "picks" JSONB;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "movie_tinder_index" INTEGER DEFAULT 0;
