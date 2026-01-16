
import 'dotenv/config';
import prisma from '../src/db/prismaClient.js';
// Note: Prisma 7 Unsupported types are strings in JS, but we use raw query to cast.

async function migrateVectors() {
    try {
        console.log('Fetching memories with embeddings...');

        // Fetch all memories that have JSON embedding but no vector column
        const memories = await prisma.memoryEntry.findMany({
            where: {
                OR: [
                    { memoryEmbeddingNew: { not: null } },
                    { memoryEmbedding: { not: null } }
                ]
                // We can't easily filter by "embedding IS NULL" via Prisma Client type yet if it's Unsupported
                // So we just fetch all and check or upsert.
                // Or simpler: just process all.
            },
            select: {
                id: true,
                memoryEmbeddingNew: true,
                memoryEmbedding: true
            }
        });

        console.log(`Found ${memories.length} memories to process.`);
        let count = 0;

        for (const mem of memories) {
            const raw = mem.memoryEmbeddingNew ?? mem.memoryEmbedding;
            if (!raw) continue;

            try {
                const vec = JSON.parse(raw);
                if (Array.isArray(vec)) {
                    // Format vector for Postgres: '[1,2,3]'
                    const vectorString = JSON.stringify(vec);

                    // Use raw query to update because Prisma doesn't support writing to Unsupported fields directly in create/update easily
                    await prisma.$executeRaw`
            UPDATE "memory_entries"
            SET "embedding" = ${vectorString}::vector
            WHERE "id" = ${mem.id}
          `;
                    count++;
                    if (count % 100 === 0) process.stdout.write('.');
                }
            } catch (e) {
                console.warn(`Failed to parse/update memory ${mem.id}: ${e.message}`);
            }
        }

        console.log(`\n✅ Successfully backfilled ${count} vectors.`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrateVectors();
