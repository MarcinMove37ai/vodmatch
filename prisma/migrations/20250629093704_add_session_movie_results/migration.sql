-- CreateTable
CREATE TABLE "session_movie_results" (
    "id" SERIAL NOT NULL,
    "session_id" VARCHAR(6) NOT NULL,
    "query_number" INTEGER NOT NULL,
    "concept_genre" VARCHAR(50) NOT NULL,
    "concept_description" TEXT NOT NULL,
    "movie_id" TEXT NOT NULL,
    "movie_title" TEXT NOT NULL,
    "movie_description" TEXT NOT NULL,
    "movie_year" TEXT NOT NULL,
    "movie_genres" TEXT NOT NULL,
    "movie_directors" TEXT NOT NULL,
    "movie_imdb_rating" TEXT NOT NULL,
    "movie_platform" JSONB NOT NULL,
    "movie_runtime" TEXT NOT NULL,
    "movie_content_rating" TEXT NOT NULL,
    "search_score" DOUBLE PRECISION NOT NULL,
    "search_type" TEXT NOT NULL,
    "hybrid_score" DOUBLE PRECISION,
    "dense_score" DOUBLE PRECISION,
    "sparse_score" DOUBLE PRECISION,
    "platform_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_movie_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_movie_results_session_id_idx" ON "session_movie_results"("session_id");

-- CreateIndex
CREATE INDEX "session_movie_results_session_id_query_number_idx" ON "session_movie_results"("session_id", "query_number");

-- AddForeignKey
ALTER TABLE "session_movie_results" ADD CONSTRAINT "session_movie_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;
