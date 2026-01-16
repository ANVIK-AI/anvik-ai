/**
 * Fix encryption keys - re-encrypt data using space.ownerId consistently
 * 
 * This script:
 * 1. Decrypts data using the old key (doc.userId / mem.userId)
 * 2. Re-encrypts with the correct key (space.ownerId)
 */
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { encrypt, decrypt, isEncrypted } from '../src/utils/encryption.js';

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');

async function fixDocumentEncryption() {
    console.log('\n📄 Fixing Document Encryption...');

    const documents = await prisma.document.findMany({
        select: {
            id: true,
            userId: true,
            title: true,
            content: true,
            summary: true,
            documentsToSpaces: {
                take: 1,
                include: { space: { select: { ownerId: true } } }
            }
        }
    });

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of documents) {
        const oldKey = doc.userId; // Key used for encryption
        const newKey = doc.documentsToSpaces?.[0]?.space?.ownerId;

        if (!newKey) {
            console.log(`  ⚠️ Doc ${doc.id.substring(0, 8)}: No space.ownerId, skipping`);
            skipped++;
            continue;
        }

        if (oldKey === newKey) {
            console.log(`  ✓ Doc ${doc.id.substring(0, 8)}: Keys already match`);
            skipped++;
            continue;
        }

        try {
            const updateData: any = {};

            // For each encrypted field: decrypt with old key, re-encrypt with new key
            if (doc.title && isEncrypted(doc.title)) {
                const decrypted = decrypt(doc.title, oldKey!);
                if (!isEncrypted(decrypted)) { // Decryption worked
                    updateData.title = encrypt(decrypted, newKey);
                }
            }

            if (doc.summary && isEncrypted(doc.summary)) {
                const decrypted = decrypt(doc.summary, oldKey!);
                if (!isEncrypted(decrypted)) {
                    updateData.summary = encrypt(decrypted, newKey);
                }
            }

            if (doc.content && isEncrypted(doc.content)) {
                const decrypted = decrypt(doc.content, oldKey!);
                if (!isEncrypted(decrypted)) {
                    updateData.content = encrypt(decrypted, newKey);
                }
            }

            if (Object.keys(updateData).length > 0) {
                if (!DRY_RUN) {
                    await prisma.document.update({
                        where: { id: doc.id },
                        data: updateData
                    });
                }
                console.log(`  ✓ Doc ${doc.id.substring(0, 8)}: Re-encrypted ${Object.keys(updateData).length} fields (${oldKey} -> ${newKey.substring(0, 8)}...)`);
                fixed++;
            } else {
                skipped++;
            }
        } catch (error) {
            console.error(`  ✗ Doc ${doc.id}: ${error}`);
            errors++;
        }
    }

    return { fixed, skipped, errors };
}

async function fixMemoryEncryption() {
    console.log('\n🧠 Fixing Memory Encryption...');

    const memories = await prisma.memoryEntry.findMany({
        select: {
            id: true,
            userId: true,
            memory: true,
            space: { select: { ownerId: true } }
        }
    });

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const mem of memories) {
        const oldKey = mem.userId; // Key used for encryption
        const newKey = mem.space?.ownerId;

        if (!newKey) {
            skipped++;
            continue;
        }

        // If already using correct key or not encrypted, skip
        if (!mem.memory || !isEncrypted(mem.memory)) {
            skipped++;
            continue;
        }

        if (oldKey === newKey) {
            skipped++;
            continue;
        }

        try {
            const decrypted = decrypt(mem.memory, oldKey!);

            // Check if decryption worked (result should not be encrypted)
            if (!isEncrypted(decrypted)) {
                const reEncrypted = encrypt(decrypted, newKey);

                if (!DRY_RUN) {
                    await prisma.memoryEntry.update({
                        where: { id: mem.id },
                        data: { memory: reEncrypted }
                    });
                }
                console.log(`  ✓ Memory ${mem.id.substring(0, 8)}: Re-encrypted`);
                fixed++;
            } else {
                // Decryption failed, old key might already be wrong
                console.log(`  ⚠️ Memory ${mem.id.substring(0, 8)}: Could not decrypt with old key`);
                skipped++;
            }
        } catch (error) {
            console.error(`  ✗ Memory ${mem.id}: ${error}`);
            errors++;
        }
    }

    return { fixed, skipped, errors };
}

async function fixChunkEncryption() {
    console.log('\n📦 Fixing Chunk Encryption...');

    const chunks = await prisma.chunk.findMany({
        select: {
            id: true,
            content: true,
            embeddedContent: true,
            document: {
                select: {
                    userId: true,
                    documentsToSpaces: {
                        take: 1,
                        include: { space: { select: { ownerId: true } } }
                    }
                }
            }
        }
    });

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const chunk of chunks) {
        const oldKey = chunk.document?.userId;
        const newKey = chunk.document?.documentsToSpaces?.[0]?.space?.ownerId;

        if (!newKey || !oldKey || oldKey === newKey) {
            skipped++;
            continue;
        }

        try {
            const updateData: any = {};

            if (chunk.content && isEncrypted(chunk.content)) {
                const decrypted = decrypt(chunk.content, oldKey);
                if (!isEncrypted(decrypted)) {
                    updateData.content = encrypt(decrypted, newKey);
                }
            }

            if (chunk.embeddedContent && isEncrypted(chunk.embeddedContent)) {
                const decrypted = decrypt(chunk.embeddedContent, oldKey);
                if (!isEncrypted(decrypted)) {
                    updateData.embeddedContent = encrypt(decrypted, newKey);
                }
            }

            if (Object.keys(updateData).length > 0) {
                if (!DRY_RUN) {
                    await prisma.chunk.update({
                        where: { id: chunk.id },
                        data: updateData
                    });
                }
                fixed++;
            } else {
                skipped++;
            }
        } catch (error) {
            errors++;
        }
    }

    console.log(`  Processed ${chunks.length} chunks: fixed=${fixed}, skipped=${skipped}, errors=${errors}`);
    return { fixed, skipped, errors };
}

async function main() {
    console.log('🔐 Fix Encryption Keys - Re-encrypt with space.ownerId');
    console.log('='.repeat(60));

    if (DRY_RUN) {
        console.log('🔍 Running in DRY RUN mode - no changes will be made\n');
    }

    const docStats = await fixDocumentEncryption();
    const memStats = await fixMemoryEncryption();
    const chunkStats = await fixChunkEncryption();

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary');
    console.log('='.repeat(60));
    console.log(`Documents: fixed=${docStats.fixed}, skipped=${docStats.skipped}, errors=${docStats.errors}`);
    console.log(`Memories:  fixed=${memStats.fixed}, skipped=${memStats.skipped}, errors=${memStats.errors}`);
    console.log(`Chunks:    fixed=${chunkStats.fixed}, skipped=${chunkStats.skipped}, errors=${chunkStats.errors}`);

    if (DRY_RUN) {
        console.log('\n📝 Dry run completed. Run without --dry-run to apply fixes.');
    } else {
        console.log('\n✅ Encryption keys fixed!');
    }

    await prisma.$disconnect();
}

main().catch(console.error);
