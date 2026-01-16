/**
 * Quick diagnostic script to check encryption state
 */
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { isEncrypted, decrypt } from '../src/utils/encryption.js';

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkEncryptionState() {
    console.log('🔍 Checking encryption state of database...\n');

    // Check memories
    const memories = await prisma.memoryEntry.findMany({
        take: 5,
        select: {
            id: true,
            memory: true,
            userId: true,
            space: {
                select: { ownerId: true }
            }
        }
    });

    console.log('=== Sample Memories ===');
    for (const m of memories) {
        const encrypted = isEncrypted(m.memory);
        const ownerId = m.userId || m.space?.ownerId || 'unknown';

        console.log(`ID: ${m.id.substring(0, 12)}...`);
        console.log(`  userId: ${m.userId}`);
        console.log(`  space.ownerId: ${m.space?.ownerId}`);
        console.log(`  isEncrypted: ${encrypted}`);
        console.log(`  preview: ${m.memory?.substring(0, 60)}...`);

        if (encrypted) {
            const decrypted = decrypt(m.memory, m.space?.ownerId || 'unknown');
            console.log(`  decrypted: ${decrypted?.substring(0, 60)}...`);
        }
        console.log('');
    }

    // Summary
    const allMemories = await prisma.memoryEntry.findMany({ select: { memory: true } });
    const encryptedCount = allMemories.filter(m => isEncrypted(m.memory)).length;
    console.log(`\n=== Summary ===`);
    console.log(`Total memories: ${allMemories.length}`);
    console.log(`Encrypted: ${encryptedCount}`);
    console.log(`Unencrypted: ${allMemories.length - encryptedCount}`);

    await prisma.$disconnect();
}

checkEncryptionState().catch(console.error);
