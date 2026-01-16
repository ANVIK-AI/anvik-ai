
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function dropVector() {
    try {
        console.log('Dropping vector extension...');
        await prisma.$executeRaw`DROP EXTENSION IF EXISTS vector`;
        console.log('✅ Extension dropped.');
    } catch (error) {
        console.error('❌ Failed to drop extension:', error);
    } finally {
        await prisma.$disconnect();
        pool.end();
    }
}

dropVector();
