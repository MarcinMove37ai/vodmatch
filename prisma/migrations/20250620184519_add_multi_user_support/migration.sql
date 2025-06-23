-- AlterTable
ALTER TABLE "session_profiles" ADD COLUMN     "has_joined" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "max_participants" INTEGER NOT NULL DEFAULT 8;
