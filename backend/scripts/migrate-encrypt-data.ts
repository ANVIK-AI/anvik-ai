/**
 * Migration script to encrypt existing data in the database
 * 
 * Usage:
 *   npx tsx scripts/migrate-encrypt-data.ts
 *   npx tsx scripts/migrate-encrypt-data.ts --dry-run  (preview only)
 * 
 * This script will:
 * 1. Find all users and their associated data
 * 2. Encrypt sensitive fields using user-specific keys
 * 3. Update records in batches
 */

// Load dotenv FIRST before any other imports that might use process.env
import dotenv from 'dotenv';
dotenv.config();

// Now import Prisma with adapter
import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { encrypt, isEncrypted, testEncryption } from '../src/utils/encryption.js';

// Create a connection pool with SSL support
const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

// Create the Prisma adapter using the pg pool
const adapter = new PrismaPg(pool);

// Initialize PrismaClient with the adapter
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 50;

interface MigrationStats {
    documents: { total: number; encrypted: number; skipped: number; errors: number };
    chunks: { total: number; encrypted: number; skipped: number; errors: number };
    memories: { total: number; encrypted: number; skipped: number; errors: number };
    spaces: { total: number; encrypted: number; skipped: number; errors: number };
    connections: { total: number; encrypted: number; skipped: number; errors: number };
}

const stats: MigrationStats = {
    documents: { total: 0, encrypted: 0, skipped: 0, errors: 0 },
    chunks: { total: 0, encrypted: 0, skipped: 0, errors: 0 },
    memories: { total: 0, encrypted: 0, skipped: 0, errors: 0 },
    spaces: { total: 0, encrypted: 0, skipped: 0, errors: 0 },
    connections: { total: 0, encrypted: 0, skipped: 0, errors: 0 },
};

async function encryptDocuments() {
    console.log('\n📄 Encrypting Documents...');

    let skip = 0;
    let hasMore = true;

    while (hasMore) {
        const documents = await prisma.document.findMany({
            skip,
            take: BATCH_SIZE,
            select: {
                id: true,
                userId: true,
                title: true,
                content: true,
                summary: true,
            },
        });

        if (documents.length === 0) {
            hasMore = false;
            break;
        }

        for (const doc of documents) {
            stats.documents.total++;

            // Skip if no userId (can't encrypt without user context)
            if (!doc.userId) {
                stats.documents.skipped++;
                continue;
            }

            // Check if already encrypted
            const titleEncrypted = doc.title ? isEncrypted(doc.title) : true;
            const contentEncrypted = doc.content ? isEncrypted(doc.content) : true;
            const summaryEncrypted = doc.summary ? isEncrypted(doc.summary) : true;

            if (titleEncrypted && contentEncrypted && summaryEncrypted) {
                stats.documents.skipped++;
                continue;
            }

            try {
                const updateData: any = {};

                if (doc.title && !isEncrypted(doc.title)) {
                    updateData.title = encrypt(doc.title, doc.userId);
                }
                if (doc.content && !isEncrypted(doc.content)) {
                    updateData.content = encrypt(doc.content, doc.userId);
                }
                if (doc.summary && !isEncrypted(doc.summary)) {
                    updateData.summary = encrypt(doc.summary, doc.userId);
                }

                if (Object.keys(updateData).length > 0) {
                    if (!DRY_RUN) {
                        await prisma.document.update({
                            where: { id: doc.id },
                            data: updateData,
                        });
                    }
                    stats.documents.encrypted++;
                    console.log(`  ✓ Document ${doc.id.substring(0, 8)}... encrypted`);
                }
            } catch (error) {
                stats.documents.errors++;
                console.error(`  ✗ Document ${doc.id}: ${error}`);
            }
        }

        skip += BATCH_SIZE;
        console.log(`  Processed ${skip} documents...`);
    }
}

async function encryptChunks() {
    console.log('\n📦 Encrypting Chunks...');

    let skip = 0;
    let hasMore = true;

    while (hasMore) {
        const chunks = await prisma.chunk.findMany({
            skip,
            take: BATCH_SIZE,
            select: {
                id: true,
                content: true,
                embeddedContent: true,
                document: {
                    select: { userId: true },
                },
            },
        });

        if (chunks.length === 0) {
            hasMore = false;
            break;
        }

        for (const chunk of chunks) {
            stats.chunks.total++;

            const userId = chunk.document?.userId;
            if (!userId) {
                stats.chunks.skipped++;
                continue;
            }

            const contentEncrypted = chunk.content ? isEncrypted(chunk.content) : true;
            const embeddedEncrypted = chunk.embeddedContent ? isEncrypted(chunk.embeddedContent) : true;

            if (contentEncrypted && embeddedEncrypted) {
                stats.chunks.skipped++;
                continue;
            }

            try {
                const updateData: any = {};

                if (chunk.content && !isEncrypted(chunk.content)) {
                    updateData.content = encrypt(chunk.content, userId);
                }
                if (chunk.embeddedContent && !isEncrypted(chunk.embeddedContent)) {
                    updateData.embeddedContent = encrypt(chunk.embeddedContent, userId);
                }

                if (Object.keys(updateData).length > 0) {
                    if (!DRY_RUN) {
                        await prisma.chunk.update({
                            where: { id: chunk.id },
                            data: updateData,
                        });
                    }
                    stats.chunks.encrypted++;
                }
            } catch (error) {
                stats.chunks.errors++;
                console.error(`  ✗ Chunk ${chunk.id}: ${error}`);
            }
        }

        skip += BATCH_SIZE;
        if (skip % 200 === 0) {
            console.log(`  Processed ${skip} chunks...`);
        }
    }
    console.log(`  Processed ${skip} total chunks`);
}

async function encryptMemories() {
    console.log('\n🧠 Encrypting Memories...');

    let skip = 0;
    let hasMore = true;

    while (hasMore) {
        const memories = await prisma.memoryEntry.findMany({
            skip,
            take: BATCH_SIZE,
            select: {
                id: true,
                userId: true,
                memory: true,
                space: {
                    select: { ownerId: true },
                },
            },
        });

        if (memories.length === 0) {
            hasMore = false;
            break;
        }

        for (const mem of memories) {
            stats.memories.total++;

            // Use memory's userId or fall back to space ownerId
            const userId = mem.userId || mem.space?.ownerId;
            if (!userId) {
                stats.memories.skipped++;
                continue;
            }

            if (!mem.memory || isEncrypted(mem.memory)) {
                stats.memories.skipped++;
                continue;
            }

            try {
                if (!DRY_RUN) {
                    await prisma.memoryEntry.update({
                        where: { id: mem.id },
                        data: {
                            memory: encrypt(mem.memory, userId),
                        },
                    });
                }
                stats.memories.encrypted++;
                console.log(`  ✓ Memory ${mem.id.substring(0, 8)}... encrypted`);
            } catch (error) {
                stats.memories.errors++;
                console.error(`  ✗ Memory ${mem.id}: ${error}`);
            }
        }

        skip += BATCH_SIZE;
        console.log(`  Processed ${skip} memories...`);
    }
}

async function encryptSpaces() {
    console.log('\n🌐 Encrypting Spaces...');

    const spaces = await prisma.space.findMany({
        select: {
            id: true,
            ownerId: true,
            name: true,
            description: true,
        },
    });

    for (const space of spaces) {
        stats.spaces.total++;

        if (!space.ownerId) {
            stats.spaces.skipped++;
            continue;
        }

        const nameEncrypted = space.name ? isEncrypted(space.name) : true;
        const descEncrypted = space.description ? isEncrypted(space.description) : true;

        if (nameEncrypted && descEncrypted) {
            stats.spaces.skipped++;
            continue;
        }

        try {
            const updateData: any = {};

            if (space.name && !isEncrypted(space.name)) {
                updateData.name = encrypt(space.name, space.ownerId);
            }
            if (space.description && !isEncrypted(space.description)) {
                updateData.description = encrypt(space.description, space.ownerId);
            }

            if (Object.keys(updateData).length > 0) {
                if (!DRY_RUN) {
                    await prisma.space.update({
                        where: { id: space.id },
                        data: updateData,
                    });
                }
                stats.spaces.encrypted++;
                console.log(`  ✓ Space ${space.id.substring(0, 8)}... encrypted`);
            }
        } catch (error) {
            stats.spaces.errors++;
            console.error(`  ✗ Space ${space.id}: ${error}`);
        }
    }
}

async function encryptConnections() {
    console.log('\n🔗 Encrypting Connections...');

    const connections = await prisma.connection.findMany({
        select: {
            id: true,
            userId: true,
            accessToken: true,
            refreshToken: true,
            email: true,
        },
    });

    for (const conn of connections) {
        stats.connections.total++;

        if (!conn.userId) {
            stats.connections.skipped++;
            continue;
        }

        const accessEncrypted = conn.accessToken ? isEncrypted(conn.accessToken) : true;
        const refreshEncrypted = conn.refreshToken ? isEncrypted(conn.refreshToken) : true;
        const emailEncrypted = conn.email ? isEncrypted(conn.email) : true;

        if (accessEncrypted && refreshEncrypted && emailEncrypted) {
            stats.connections.skipped++;
            continue;
        }

        try {
            const updateData: any = {};

            if (conn.accessToken && !isEncrypted(conn.accessToken)) {
                updateData.accessToken = encrypt(conn.accessToken, conn.userId);
            }
            if (conn.refreshToken && !isEncrypted(conn.refreshToken)) {
                updateData.refreshToken = encrypt(conn.refreshToken, conn.userId);
            }
            if (conn.email && !isEncrypted(conn.email)) {
                updateData.email = encrypt(conn.email, conn.userId);
            }

            if (Object.keys(updateData).length > 0) {
                if (!DRY_RUN) {
                    await prisma.connection.update({
                        where: { id: conn.id },
                        data: updateData,
                    });
                }
                stats.connections.encrypted++;
                console.log(`  ✓ Connection ${conn.id.substring(0, 8)}... encrypted`);
            }
        } catch (error) {
            stats.connections.errors++;
            console.error(`  ✗ Connection ${conn.id}: ${error}`);
        }
    }
}

function printStats() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));

    if (DRY_RUN) {
        console.log('⚠️  DRY RUN MODE - No changes were made to the database\n');
    }

    const tables = ['documents', 'chunks', 'memories', 'spaces', 'connections'] as const;

    for (const table of tables) {
        const s = stats[table];
        console.log(`${table.charAt(0).toUpperCase() + table.slice(1)}:`);
        console.log(`  Total: ${s.total} | Encrypted: ${s.encrypted} | Skipped: ${s.skipped} | Errors: ${s.errors}`);
    }

    const totalEncrypted = tables.reduce((sum, t) => sum + stats[t].encrypted, 0);
    const totalErrors = tables.reduce((sum, t) => sum + stats[t].errors, 0);

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Total records encrypted: ${totalEncrypted}`);
    if (totalErrors > 0) {
        console.log(`❌ Total errors: ${totalErrors}`);
    }
    console.log('='.repeat(60));
}

async function main() {
    console.log('🔐 Database Encryption Migration');
    console.log('='.repeat(60));

    if (DRY_RUN) {
        console.log('🔍 Running in DRY RUN mode - no changes will be made');
    }

    // Test encryption first
    console.log('\n🧪 Testing encryption system...');
    if (!testEncryption('migration-test-user')) {
        console.error('❌ Encryption test failed! Aborting migration.');
        process.exit(1);
    }

    try {
        // Run encryption for each table
        await encryptDocuments();
        await encryptChunks();
        await encryptMemories();
        await encryptSpaces();
        await encryptConnections();

        printStats();

        if (!DRY_RUN) {
            console.log('\n✅ Migration completed successfully!');
        } else {
            console.log('\n📝 Dry run completed. Run without --dry-run to apply changes.');
        }
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
