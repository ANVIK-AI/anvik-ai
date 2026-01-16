import PgBoss from 'pg-boss';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}
if (!process.env.EMBEDDINGS_DATABASE_URL) {
  throw new Error('EMBEDDINGS_DATABASE_URL environment variable is required');
}

// Configure pg-boss with SSL for production (AWS RDS)
const bossOptions: PgBoss.ConstructorOptions = {
  connectionString: process.env.DATABASE_URL,
  // SSL configuration for AWS RDS
  ...(process.env.NODE_ENV === 'production' && {
    ssl: { rejectUnauthorized: false },
  }),
};

export const boss = new PgBoss(bossOptions);

boss.on('error', console.error);

export const JOB_PROCESS_DOCUMENT = 'process-document';

export async function startBoss() {
  await boss.start();
  await boss.createQueue(JOB_PROCESS_DOCUMENT);
}
