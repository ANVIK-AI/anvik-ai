
import 'dotenv/config';
import prisma from '../src/db/prismaClient.js';
import { MemoryService } from '../src/services/chat.service.js';

async function verifySearch() {
    const service = new MemoryService();
    // Find a space ID to test with.
    const space = await prisma.space.findFirst();
    if (!space) {
        console.log('No spaces found to test.');
        return;
    }

    console.log(`Testing search in space ${space.id}...`);
    const query = "get the gmail of ayush patil";

    try {
        const results = await service.searchMemories(query, space.id);
        console.log('Search Results:', JSON.stringify(results, null, 2));

        if (results.success) {
            console.log(`✅ Search successful. Found ${results.count} items.`);
        } else {
            console.log('❌ Search failed.');
        }

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        await prisma.$disconnect();
        // Force exit because service might keep connections open
        process.exit(0);
    }
}

verifySearch();
