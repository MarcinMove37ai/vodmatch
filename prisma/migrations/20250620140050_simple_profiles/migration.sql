/*
  Warnings:

  - You are about to drop the column `admin_profile` on the `sessions` table. All the data in the column will be lost.
  - You are about to alter the column `viewing_mode` on the `sessions` table. The data in that column could be lost. The data in that column will be cast from `JsonB` to `VarChar(20)`.

*/
-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "admin_profile",
ALTER COLUMN "viewing_mode" SET DATA TYPE VARCHAR(20);

-- CreateTable
CREATE TABLE "session_profiles" (
    "id" SERIAL NOT NULL,
    "session_id" VARCHAR(6) NOT NULL,
    "user_id" VARCHAR(50) NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "username" TEXT NOT NULL,
    "pic_url" TEXT,
    "posts" TEXT,
    "quiz_result" JSONB DEFAULT '{}',
    "seen" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_profiles_session_id_user_id_key" ON "session_profiles"("session_id", "user_id");

-- AddForeignKey
ALTER TABLE "session_profiles" ADD CONSTRAINT "session_profiles_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;
