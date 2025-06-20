-- CreateTable
CREATE TABLE "sessions" (
    "session_id" VARCHAR(6) NOT NULL,
    "admin_id" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "selected_platforms" JSONB NOT NULL DEFAULT '[]',
    "viewing_mode" JSONB,
    "admin_profile" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'setup',
    "current_step" VARCHAR(50) NOT NULL DEFAULT 'platforms',

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("session_id")
);
