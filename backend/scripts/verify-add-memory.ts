
import 'dotenv/config';
import prisma from '../src/db/prismaClient.js';
import { MemoryService } from '../src/services/chat.service.js';

async function verifyAddMemory() {
    const service = new MemoryService();
    const space = await prisma.space.findFirst();
    if (!space) {
        console.log('No spaces found.');
        return;
    }

    const testMemory = "This is a test memory to verify vector storage " + Date.now();
    console.log(`Adding memory: "${testMemory}" to space ${space.id}`);

    try {
        const result = await service.addMemory(testMemory, space.id);
        if (!result.success || !result.memory.id) {
            console.error('Failed to add memory.');
            return;
        }

        console.log(`Memory added with ID: ${result.memory.id}`);

        // verify database
        const rows = await prisma.$queryRaw<any[]>`
        SELECT id, embedding FROM "memory_entries" WHERE "id" = ${result.memory.id}
    `;

        // rows returned by $queryRaw might be a bit different depending on driver
        // but usually it's an array of objects
        const row = rows[0];
        if (row && row.embedding) {
            console.log('✅ Success! Memory has vector embedding stored.');
        } else {
            console.error('❌ Failure! Memory created but embedding is NULL.');
            console.log('Row:', row);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        const memory = await prisma.memoryEntry.findFirst({ where: { memory: testMemory } });
        if (memory) {
            await prisma.memoryEntry.delete({ where: { id: memory.id } });
            console.log('Cleaned up test memory.');
        }
        await prisma.$disconnect();
    }
}

verifyAddMemory();
