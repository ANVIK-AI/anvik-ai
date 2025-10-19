-- Enable pgvector and create embeddings table & index
CREATE EXTENSION IF NOT EXISTS vector;


CREATE TABLE IF NOT EXISTS embeddings (
id SERIAL PRIMARY KEY,
object_id TEXT NOT NULL,
embedding vector(1536),
metadata JSONB,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);