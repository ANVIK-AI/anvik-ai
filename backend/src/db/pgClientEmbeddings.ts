import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.EMBEDDINGS_DATABASE_URL,
  max: 10,
  // Enable SSL for production (AWS RDS)
  // rejectUnauthorized: false allows AWS RDS certificates
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export default pool;
