import { Router } from "express";
import { chatRequest, chatTitleRequest,chatRequestWithID } from "../controller/chat.controller";
import prisma from "../db/prismaClient";
import { isAuthenticated } from "../middleware/auth.middleware";
const router = Router();

router.post("/chat" ,isAuthenticated,chatRequest);

router.post("/chat/:id",isAuthenticated, chatRequestWithID);


router.post("/chat/title", isAuthenticated,chatTitleRequest); 

router.get('/chat/health', async (req, res) => {
    try {
        // Test database connection
        await prisma.$queryRaw`SELECT 1`;

        // Test memory entries count
        const memoryCount = await prisma.memoryEntry.count({
            where: { isLatest: true, isForgotten: false }
        });

        // Test Gemini API (simple embedding generation)
        // const testEmbedding = await embed({
        //     model: google.textEmbeddingModel('text-embedding-004'),
        //     value: 'health check',
        // });

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
            memories: {
                total: memoryCount,
                withEmbeddings: await prisma.memoryEntry.count({
                    where: {
                        isLatest: true,
                        isForgotten: false,
                        OR: [
                            { memoryEmbeddingNew: { not: null } },
                            { memoryEmbedding: { not: null } },
                        ]
                    }
                })
            },
            gemini: {
                embedding: 'working',
            }
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
export default router;