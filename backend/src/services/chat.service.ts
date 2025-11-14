import { z } from "zod";
import prisma from "../db/prismaClient";
import { embeddingModelName } from '../gemini'
import logger from "../utils/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const chatRequestSchema = z.object({
    messages: z.array(z.any()),
    metadata: z.object({
        projectId: z.string(), // This is spaceId in database
        model: z.string().optional() // We'll use Gemini regardless
    })
});

export const titleRequestSchema = z.object({
    prompt: z.string()
});

if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required')
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Memory service using Prisma and MemoryEntry table
export class MemoryService {
    // --- Tunables ---
    private getTopK(): number {
        const raw = process.env.MEM_SEARCH_TOP_K;
        const val = raw ? Number(raw) : 10;
        return Number.isFinite(val) && val > 0 ? Math.min(val, 50) : 10;
    }

    private getMinSimilarity(): number {
        const raw = process.env.MEM_SEARCH_MIN_SIMILARITY;
        const val = raw ? Number(raw) : 0.2;
        if (!Number.isFinite(val)) return 0.2;
        return Math.max(0, Math.min(1, val));
    }

    private getUpdateMinSimilarity(): number {
        const raw = process.env.MEM_UPDATE_MIN_SIMILARITY;
        const val = raw ? Number(raw) : 0.75;
        if (!Number.isFinite(val)) return 0.75;
        return Math.max(0, Math.min(1, val));
    }

    private getUpdateMaxParents(): number {
        const raw = process.env.MEM_UPDATE_MAX_PARENTS;
        const val = raw ? Number(raw) : 1;
        return Number.isFinite(val) && val >= 0 ? Math.min(val, 5) : 1;
    }
    // Generate embedding for text using Gemini
    private async generateEmbedding(text: string): Promise<number[]> {
        try {
            logger.debug({
                msg: 'Generating embedding',
                textLength: text?.length ?? 0,
                model: embeddingModelName()
            });
            const model = genAI.getGenerativeModel({
                model: embeddingModelName(),
            });

            const result = await model.embedContent(text);
            const values = result.embedding.values;
            logger.debug({
                msg: 'Embedding generated',
                dimensions: values?.length
            });
            return values;
        } catch (error) {
            logger.error({ msg: 'Error generating embedding', error });
            throw new Error('Failed to generate embedding');
        }

    }

    // Search memories using vector similarity on MemoryEntry table
    async searchMemories(query: string, projectId: string): Promise<{
        success: boolean;
        count: number;
        results: Array<{
            documentId: string;
            title?: string;
            content?: string;
            url?: string;
            score?: number;
        }>;
    }> {
        try {
            logger.info({
                msg: 'Searching memories',
                projectId,
                queryLength: query?.length ?? 0
            });
            // Generate embedding for the query
            const queryEmbedding = await this.generateEmbedding(query);
            const queryEmbeddingStr = JSON.stringify(queryEmbedding);

            // Search memories using vector similarity
            // Prefer the new embedding field, but fall back to legacy if needed
            const memories = await prisma.memoryEntry.findMany({
                where: {
                    spaceId: projectId,
                    isLatest: true,
                    isForgotten: false,
                    OR: [
                        { memoryEmbeddingNew: { not: null } },
                        { memoryEmbedding: { not: null } }
                    ]
                },
                select: {
                    id: true,
                    memory: true,
                    metadata: true,
                    memoryEmbeddingNew: true,
                    memoryEmbedding: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' },
                take: 25
            });

            logger.debug({
                msg: 'Fetched candidate memories',
                projectId,
                candidates: memories.length
            });

            // Calculate similarity scores and sort
            const resultsWithScores = await Promise.all(
                memories.map(async (memory) => {
                    const rawEmbedding = memory.memoryEmbeddingNew ?? memory.memoryEmbedding;
                    if (!rawEmbedding) return null;

                    try {
                        const memoryEmbedding = JSON.parse(rawEmbedding);
                        if (!Array.isArray(memoryEmbedding) || memoryEmbedding.length !== queryEmbedding.length) {
                            logger.warn({
                                msg: 'Embedding dimension mismatch; skipping',
                                memoryId: memory.id,
                                memoryDim: Array.isArray(memoryEmbedding) ? memoryEmbedding.length : 'invalid',
                                queryDim: queryEmbedding.length
                            });
                            return null;
                        }
                        const score = this.calculateCosineSimilarity(queryEmbedding, memoryEmbedding);

                        return {
                            documentId: memory.id,
                            title: (memory.metadata as any)?.title || this.extractTitleFromMemory(memory.memory),
                            content: memory.memory,
                            score: score,
                            url: (memory.metadata as any)?.url,
                            createdAt: memory.createdAt
                        };
                    } catch (error) {
                        logger.warn({
                            msg: 'Error parsing memory embedding; skipping',
                            memoryId: memory.id,
                            error
                        });
                        return null;
                    }
                })
            );

            // Filter out nulls and sort by score with threshold
            const minSim = this.getMinSimilarity();
            const topK = this.getTopK();
            const validResults = resultsWithScores
                .filter((result): result is NonNullable<typeof result> => result !== null && (result.score || 0) >= minSim)
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, topK);

            logger.info({
                msg: 'Search completed',
                projectId,
                returned: validResults.length
            });
            return {
                success: true,
                count: validResults.length,
                results: validResults
            };
        } catch (error) {
            logger.error({ msg: 'Error searching memories', projectId, error });
            return {
                success: false,
                count: 0,
                results: []
            };
        }
    }

    // Add a new memory with embedding
    async addMemory(memory: string, projectId: string): Promise<{
        success: boolean;
        memory: {
            id: string;
            status: string;
        };
    }> {
        try {
            logger.info({
                msg: 'Adding memory',
                projectId,
                memoryLength: memory?.length ?? 0
            });
            // Verify space exists and get orgId
            const space = await prisma.space.findUnique({
                where: { id: projectId },
                select: { orgId: true }
            });

            if (!space) {
                logger.warn({ msg: 'Space not found when adding memory', projectId });
                throw new Error(`Space with id ${projectId} not found`);
            }

            // Generate embedding for the memory (for storage and similarity)
            const embedding = await this.generateEmbedding(memory);
            const embeddingStr = JSON.stringify(embedding);

            // Find related existing memories (latest, same space) by cosine similarity
            const candidateLatest = await prisma.memoryEntry.findMany({
                where: {
                    spaceId: projectId,
                    isLatest: true,
                    isForgotten: false,
                    OR: [
                        { memoryEmbeddingNew: { not: null } },
                        { memoryEmbedding: { not: null } }
                    ]
                },
                select: {
                    id: true,
                    memory: true,
                    memoryEmbeddingNew: true,
                    memoryEmbedding: true,
                    version: true,
                    parentMemoryId: true,
                    rootMemoryId: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
            });

            const scored = candidateLatest
                .map((m) => {
                    const raw = m.memoryEmbeddingNew ?? m.memoryEmbedding;
                    if (!raw) return null;
                    try {
                        const vec = JSON.parse(raw);
                        if (!Array.isArray(vec) || vec.length !== embedding.length) return null;
                        const score = this.calculateCosineSimilarity(embedding, vec);
                        return { m, score };
                    } catch {
                        return null;
                    }
                })
                .filter((x): x is { m: typeof candidateLatest[number]; score: number } => !!x)
                .sort((a, b) => b.score - a.score);

            const minUpdateSim = this.getUpdateMinSimilarity();
            const maxParents = this.getUpdateMaxParents();
            const parents = scored.filter(s => s.score >= minUpdateSim).slice(0, maxParents);

            // Prepare versioning fields if an update parent is found (pick best one)
            const primaryParent = parents[0]?.m;
            const version = primaryParent ? (primaryParent.version || 1) + 1 : 1;
            const parentMemoryId = primaryParent ? primaryParent.id : null;
            const rootMemoryId = primaryParent ? (primaryParent.rootMemoryId || primaryParent.id) : null;

            // Memory relations: map parentId -> "updates"
            const memoryRelations: Record<string, 'updates' | 'extends' | 'derives'> = {};
            if (primaryParent) {
                memoryRelations[primaryParent.id] = 'updates';
            }

            // Create all entities and links in a single transaction
            const result = await prisma.$transaction(async (tx) => {
                // If we have a parent, mark it as not-latest
                if (primaryParent) {
                    await tx.memoryEntry.update({
                        where: { id: primaryParent.id },
                        data: { isLatest: false }
                    });
                }

                // Create the new memory entry (latest)
                const memoryEntry = await tx.memoryEntry.create({
                    data: {
                        memory,
                        spaceId: projectId,
                        orgId: space.orgId,
                        version,
                        isLatest: true,
                        parentMemoryId,
                        rootMemoryId,
                        memoryRelations: memoryRelations as any,
                        memoryEmbeddingNew: embeddingStr,
                        memoryEmbeddingNewModel: embeddingModelName(),
                        metadata: {
                            title: this.extractTitleFromMemory(memory),
                            createdAt: new Date().toISOString(),
                            type: 'user_memory',
                            source: 'chat',
                            updateFrom: primaryParent?.id ?? null,
                        }
                    }
                });

                // Create a dedicated document for this memory and attach it to the current space
                const memoryTitle = this.extractTitleFromMemory(memory);
                const memoryDocument = await tx.document.create({
                    data: {
                        orgId: space.orgId,
                        userId: 'system',
                        title: memoryTitle,
                        type: 'text',
                        status: 'active',
                        metadata: { source: 'chat', synthetic: true }
                    }
                });

                // Link the document to this space so it appears under the correct project
                await tx.documentsToSpaces.create({
                    data: {
                        documentId: memoryDocument.id,
                        spaceId: projectId
                    }
                });

                // Link the new memory to the created document so it appears in the graph UI
                await tx.memoryDocumentSource.create({
                    data: {
                        memoryEntryId: memoryEntry.id,
                        documentId: memoryDocument.id,
                        relevanceScore: 100,
                        metadata: { linkedBy: 'chat.service.addMemory' }
                    }
                });

                return { memoryEntry };
            });

            logger.info({
                msg: primaryParent ? 'Memory created (update)' : 'Memory created',
                projectId,
                memoryId: result.memoryEntry.id,
                parentMemoryId: primaryParent?.id,
            });
            return {
                success: true,
                memory: {
                    id: result.memoryEntry.id,
                    status: primaryParent ? 'created:update' : 'created'
                }
            };
        } catch (error) {
            logger.error({ msg: 'Error adding memory', projectId, error });
            return {
                success: false,
                memory: {
                    id: '',
                    status: 'error'
                }
            };
        }
    }

    // Fetch specific memory by ID
    async fetchMemory(memoryId: string, projectId: string): Promise<any> {
        try {
            logger.info({
                msg: 'Fetching memory',
                projectId,
                memoryId
            });
            const memory = await prisma.memoryEntry.findFirst({
                where: {
                    id: memoryId,
                    spaceId: projectId,
                    isLatest: true,
                    isForgotten: false
                },
                include: {
                    documentSources: {
                        include: {
                            document: {
                                select: {
                                    id: true,
                                    title: true,
                                    url: true,
                                    type: true
                                }
                            }
                        }
                    }
                }
            });

            if (!memory) {
                logger.warn({ msg: 'Memory not found', projectId, memoryId });
                throw new Error('Memory not found');
            }

            logger.debug({
                msg: 'Fetched memory with document sources',
                projectId,
                memoryId,
                documentSources: memory.documentSources?.length ?? 0
            });
            return {
                success: true,
                memory: {
                    id: memory.id,
                    content: memory.memory,
                    metadata: memory.metadata,
                    createdAt: memory.createdAt,
                    documentSources: memory.documentSources.map(source => ({
                        documentId: source.documentId,
                        relevanceScore: source.relevanceScore,
                        document: source.document
                    }))
                }
            };
        } catch (error) {
            logger.error({ msg: 'Error fetching memory', projectId, memoryId, error });
            return {
                success: false,
                error: 'Memory not found or access denied'
            };
        }
    }

    // Calculate cosine similarity between two vectors
    private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length) {
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += (vecA[i] ?? 0) * (vecB[i] ?? 0);
            normA += (vecA[i] || 0) * (vecA[i] || 0);
            normB += (vecB[i] ?? 0) * (vecB[i] ?? 0);
        }

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    // Helper to extract title from memory content
    private extractTitleFromMemory(memory: string): string {
        // Simple title extraction - first sentence or first 50 chars
        const sentences = memory.split(/[.!?]/);
        const firstSentence = sentences[0]?.trim();

        if (firstSentence && firstSentence.length > 10) {
            return firstSentence.length > 80 ? firstSentence.slice(0, 77) + '...' : firstSentence;
        }

        // Fallback: first 50 characters
        return memory.length > 50 ? memory.slice(0, 47) + '...' : memory;
    }
}
