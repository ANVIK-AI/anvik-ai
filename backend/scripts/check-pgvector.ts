
import 'dotenv/config'; // Load env vars first
import prisma from '../src/db/prismaClient.js';

async function checkVector() {
    try {
        console.log('Checking for vector extension...');
        const result = await prisma.$queryRaw`SELECT * FROM pg_extension WHERE extname = 'vector'`;
        console.log('Extension check result:', result);

        if (Array.isArray(result) && result.length > 0) {
            console.log('✅ pgvector is already installed.');
        } else {
            console.log('Attempting to create extension...');
            await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
            console.log('✅ pgvector extension created successfully.');
        }
    } catch (error) {
        console.error('❌ Error details:', error);
    } finally {
        process.exit(0);
    }
}

checkVector();
