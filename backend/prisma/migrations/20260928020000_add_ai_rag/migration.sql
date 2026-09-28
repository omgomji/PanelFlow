ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiAccessVersion" INTEGER NOT NULL DEFAULT 0;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "rag_sources" (
  "id" UUID NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "index_version" INTEGER NOT NULL DEFAULT 1,
  "chunk_count" INTEGER NOT NULL DEFAULT 0,
  "indexed_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rag_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rag_sources_source_type_source_id_key"
  ON "rag_sources"("source_type", "source_id");
CREATE INDEX IF NOT EXISTS "rag_sources_source_type_idx" ON "rag_sources"("source_type");
CREATE INDEX IF NOT EXISTS "rag_sources_updated_at_idx" ON "rag_sources"("updated_at");

CREATE TABLE IF NOT EXISTS "rag_chunks" (
  "id" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "embedding" vector(1536) NOT NULL,
  CONSTRAINT "rag_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rag_chunks_embedding_hnsw_idx"
  ON "rag_chunks" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "rag_chunks_metadata_gin_idx"
  ON "rag_chunks" USING gin ("metadata" jsonb_path_ops);

CREATE INDEX IF NOT EXISTS "rag_chunks_content_fts_idx"
  ON "rag_chunks" USING gin (to_tsvector('simple', "content"));
