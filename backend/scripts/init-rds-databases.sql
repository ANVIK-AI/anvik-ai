-- =============================================================================
-- AWS RDS PostgreSQL Database Initialization Script
-- =============================================================================
-- Run this script against your RDS instance to set up the required databases.
-- 
-- Prerequisites:
--   1. RDS PostgreSQL 15+ instance created
--   2. pgvector extension available (RDS supports pgvector natively)
--   3. Connected as the master user
--
-- Usage:
--   psql -h <rds-endpoint> -U <master-user> -d postgres -f init-rds-databases.sql
-- =============================================================================

-- Create the main application database
CREATE DATABASE appdb;

-- Create the embeddings database  
CREATE DATABASE embeddingsdb;

-- Connect to embeddings database and enable pgvector
\c embeddingsdb;

-- Enable pgvector extension (required for vector similarity search)
-- Note: pgvector is supported on Amazon RDS PostgreSQL 15+
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
    id SERIAL PRIMARY KEY,
    object_id TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create vector similarity search index
-- Note: ivfflat index requires data to exist first for optimal performance
-- For initial setup, you can create the index after data is loaded
CREATE INDEX IF NOT EXISTS idx_embeddings_object_id ON embeddings(object_id);

-- Optional: Create ivfflat index for approximate nearest neighbor search
-- Uncomment after you have loaded some data (at least 1000 rows recommended)
-- CREATE INDEX IF NOT EXISTS idx_embeddings_vector 
--     ON embeddings USING ivfflat (embedding vector_cosine_ops) 
--     WITH (lists = 100);

-- Grant permissions (replace 'your_app_user' with your application user)
-- GRANT ALL PRIVILEGES ON DATABASE appdb TO your_app_user;
-- GRANT ALL PRIVILEGES ON DATABASE embeddingsdb TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

\echo 'Database initialization complete!'
\echo 'Next steps:'
\echo '  1. Update your .env file with the RDS connection strings'
\echo '  2. Run prisma migrate deploy to create tables in appdb'
\echo '  3. Deploy your application'
