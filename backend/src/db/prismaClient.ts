import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

// Create a connection pool with SSL support for production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Enable SSL for production (AWS RDS)
  // rejectUnauthorized: false allows AWS RDS certificates
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

// Create the Prisma adapter using the pg pool
const adapter = new PrismaPg(pool);

// Initialize PrismaClient with the adapter (Prisma 7 requirement)
const prisma = new PrismaClient({ adapter });

export default prisma;
