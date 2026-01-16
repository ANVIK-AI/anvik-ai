import { boss, JOB_PROCESS_DOCUMENT } from './queue.js';
import prisma from './db/prismaClient.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { embeddingModelName } from './gemini.js';
import { v4 as uuidv4 } from 'uuid';
import { PDFParse } from 'pdf-parse';
import path from 'path';
import { TaskType } from '@google/generative-ai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getDefaultChatModel } from './providers/ai-provider.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { encrypt, decrypt } from './utils/encryption.js';

import { createRequire } from 'module';
// import { title } from 'process'
const require = createRequire(import.meta.url);

// If you need DOCX/CSV/MD parsing, import libraries (mammoth, papaparse, etc.)
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

interface ProcessDocumentJob {
  documentId: string;
}

export async function registerWorkers() {
  console.log('reached here');
  await boss.work(JOB_PROCESS_DOCUMENT, async ([job]: any) => {
    console.log(`received job ${job.id}`);

    const { documentId } = job.data as ProcessDocumentJob;
    try {
      await step(documentId, 'extracting', async () => {
        console.log('extracting');
        const { text, type } = await extractText(documentId);
        await prisma.document.update({
          where: { id: documentId },
          data: { content: text, type },
        });
      });

      await step(documentId, 'chunking', async () => {
        console.log('chunking');

        const doc = await getDoc(documentId);
        if (!doc?.content) {
          console.warn(`No content found for document at chunking ${documentId}`);
          return;
        }

        const chunks = semanticChunk(doc.content, {
          targetSize: 1200,
          overlap: 200,
          maxChunkSize: 1500,
        });

        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const averageChunkSize = chunks.length > 0 ? Math.round(totalLength / chunks.length) : 0;

        // Prepare batch data
        const chunkData = chunks.map((content, i) => ({
          id: uuidv4(),
          documentId,
          position: i,
          content: content || '',
          type: 'text',
        }));

        try {
          await prisma.$transaction(async (tx) => {
            // Delete existing chunks if reprocessing
            await tx.chunk.deleteMany({
              where: { documentId },
            });

            // Create all chunks
            await tx.chunk.createMany({
              data: chunkData,
            });

            // Update document
            await tx.document.update({
              where: { id: documentId },
              data: {
                chunkCount: chunks.length,
                averageChunkSize: averageChunkSize.toString(),
              },
            });
          });
        } catch (error) {
          console.error(`Chunking failed for document ${documentId}:`, error);
          throw error;
        }
      });

      await step(documentId, 'embedding', async () => {
        console.log('embedding');

        const model = genAI.getGenerativeModel({
          model: embeddingModelName(),
        });

        const chunks = await prisma.chunk.findMany({
          where: { documentId },
          orderBy: { position: 'asc' },
        });

        if (chunks.length === 0) {
          console.log('No chunks to embed for document:', documentId);
          return;
        }

        try {
          // 1. Create a batch request for the Gemini API
          const requests = chunks.map((chunk) => ({
            content: {
              role: 'user',
              parts: [{ text: chunk.content }],
            },
            taskType: 'RETRIEVAL_DOCUMENT' as TaskType,
          }));

          // The requests array needs to be passed as the value of a 'requests' property
          const result = await model.batchEmbedContents({ requests });

          const embeddings = result.embeddings;

          if (!embeddings || embeddings.length !== chunks.length) {
            throw new Error('Mismatch between chunk count and embedding count');
          }

          // 3. Prepare all database updates
          const updatePromises = chunks.map((chunk, i) => {
            const vector = embeddings[i]?.values;

            if (!vector) {
              console.warn(
                `No embedding returned for chunk ${chunk.id} (position ${chunk.position})`,
              );
              return Promise.resolve(); // Skip this chunk
            }

            return prisma.chunk.update({
              where: { id: chunk.id },
              data: {
                embedding: JSON.stringify(vector),
                embeddingModel: embeddingModelName(),
              },
            });
          });

          // 4. Run all database updates in parallel
          await Promise.all(updatePromises);

          console.log(`Successfully embedded ${chunks.length} chunks for document ${documentId}`);
        } catch (error) {
          console.error(`Embedding failed for document ${documentId}:`, error);
          throw error; // Re-throw to fail the 'step'
        }
      });

      await step(documentId, 'extract_document_essentials', async () => {
        console.log(
          `[${new Date().toISOString()}] Starting extract_document_essentials for document ${documentId}`,
        );

        const doc = await getDoc(documentId);
        if (!doc?.content) {
          console.warn(`No content found for document ${documentId}`);
          return;
        }

        // Get space info for memory linking and encryption
        const spaceRows = await prisma.documentsToSpaces.findMany({
          where: { documentId },
          include: { space: { select: { id: true, ownerId: true, orgId: true } } },
        });
        const spaceId = spaceRows[0]?.spaceId;
        const spaceOwnerId = spaceRows[0]?.space?.ownerId || doc.userId;
        if (!spaceId) {
          console.warn(`No space found for document ${documentId}`);
          return;
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const embedder = genAI.getGenerativeModel({ model: embeddingModelName() });

        const prompt = `
          You are analyzing a document to extract essential information for a personal AI assistant memory system.

          **TASK:** Extract the following components in a SINGLE JSON response:

          1. **title**: A descriptive, professional title (5-10 words) that captures the document's essence
          2. **summary**: A concise 2-4 sentence summary focusing on key facts, experiences, and achievements
          3. **memories**: 15-25 concise, atomic factual statements that represent key information worth remembering

          **CRITICAL GUIDELINES FOR MEMORIES:**

          **Format Requirements:**
          - Each memory must be a complete, standalone factual statement
          - Use consistent naming format: "[Full Name] [factual statement]"
          - Keep each memory to 1-2 short sentences maximum
          - Focus on atomic facts that can be independently retrieved

          **Content Requirements:**
          - Extract ALL key personal information: contact details, education, work experience, projects, skills, achievements, certifications
          - Include specific details: dates, technologies used, company names, project names, achievements
          - Maintain third-person perspective consistently
          - Prioritize factual, verifiable information over opinions
          - Include both explicit facts and strongly implied information

          **Memory Examples (Correct Format):**
          ✅ "Yash Sanjyot Ainapure email is ainapureyash2@gmail.com"
          ✅ "Yash Sanjyot Ainapure studies B.Tech Computer Science at D.Y.Patil College of Engineering and Technology with GPA 7.4"
          ✅ "Yash Sanjyot Ainapure interned as Frontend Developer at SIBIC Incubation Center"
          ✅ "Yash Sanjyot Ainapure built IMS software frontend using React, Redux, Spring Boot, MySQL at SIBIC Incubation Center"
          ✅ "Yash Sanjyot Ainapure won 1st rank in Pratham Code hackathon in June 2024"

          **Avoid These:**
          ❌ Incomplete facts: "Email: ainapureyash2@gmail.com" 
          ❌ First person: "I studied at D.Y.Patil College"
          ❌ Generic statements: "He is good at programming"
          ❌ Long narratives: "During his internship he worked on multiple projects including..."

          **EDGE CASES:**
          - For resumes: Extract all sections (education, experience, projects, skills, achievements)
          - For very short documents: Adjust memory count accordingly
          - Handle missing information gracefully - don't fabricate facts
          - For technical documents: Focus on key findings and applications
          - Maintain consistent name formatting throughout all memories

          **RETURN FORMAT:**
          Return ONLY valid JSON with this exact structure:
          {
            "title": "Descriptive professional title here",
            "summary": "2-4 sentence comprehensive summary here",
            "memories": [
              "Complete factual statement 1",
              "Complete factual statement 2",
              "Complete factual statement 3"
            ]
          }

          **DOCUMENT CONTENT:**
          ---
          ${doc.content.substring(0, Math.min(doc.content.length, 15000))}
          ---

          Remember: Focus on extracting ALL important factual information.
          `;
        try {
          const { object } = await generateObject({
            model: getDefaultChatModel(),
            schema: z.object({
              title: z.string(),
              summary: z.string(),
              memories: z.array(z.string()),
            }),
            prompt,
          });

          console.log(
            `[${new Date().toISOString()}] Successfully generated document essentials using generateObject for document ${documentId}`,
          );

          // Validate required fields
          if (
            object.title.length === 0 ||
            object.summary.length === 0 ||
            object.memories.length <= 0
          ) {
            console.error('Missing required fields in generated object:', object);
            await generateFallbackContent(documentId, doc, spaceId, model, embedder, spaceOwnerId);
            return;
          }

          // Update document with encrypted title and summary
          await prisma.document.update({
            where: { id: documentId },
            data: {
              title: encrypt(object.title.trim(), spaceOwnerId),
              summary: encrypt(object.summary.trim(), spaceOwnerId),
            },
          });

          // Embed and store summary
          try {
            const summaryEmbedding = await embedder.embedContent(object.summary);
            await prisma.document.update({
              where: { id: documentId },
              data: {
                summaryEmbedding: JSON.stringify(summaryEmbedding.embedding.values),
                summaryEmbeddingModel: embeddingModelName(),
              },
            });
          } catch (embedError) {
            console.error('Failed to embed summary:', embedError);
          }

          // Process memories
          const validMemories = object.memories
            .filter((memory: string) => memory && memory.trim() && memory.length > 10)
            .slice(0, 30); // Limit to prevent overflow

          console.log(
            `[${new Date().toISOString()}] Processing ${validMemories.length} valid memories`,
          );

          // Create memory entries with batching
          const BATCH_SIZE = 3;
          let createdMemories = 0;

          for (let i = 0; i < validMemories.length; i += BATCH_SIZE) {
            const batch = validMemories.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (memory: string) => {
              try {
                const emb = await embedder.embedContent(memory);
                const memoryId = uuidv4();

                // Encrypt memory content before storage
                const encryptedMemory = encrypt(memory.trim(), spaceOwnerId);

                await prisma.memoryEntry.create({
                  data: {
                    id: memoryId,
                    memory: encryptedMemory,
                    spaceId: spaceId,
                    orgId: doc.orgId,
                    userId: spaceOwnerId, // Store for decryption
                    version: 1,
                    isLatest: true,
                    isInference: false,
                    memoryEmbedding: JSON.stringify(emb.embedding.values),
                    memoryEmbeddingModel: embeddingModelName(),
                    metadata: {
                      source: 'document_extraction',
                      documentId: documentId,
                    },
                  },
                });

                // Update column with the vector for pgvector search
                const vectorStr = JSON.stringify(emb.embedding.values);
                await prisma.$executeRaw`
                  UPDATE "memory_entries"
                  SET "embedding" = ${vectorStr}::vector
                  WHERE "id" = ${memoryId}
                `;

                await prisma.memoryDocumentSource.create({
                  data: {
                    memoryEntryId: memoryId,
                    documentId,
                    relevanceScore: 100,
                  },
                });

                createdMemories++;
                return memoryId;
              } catch (error) {
                console.error(`Error creating memory for: ${memory.substring(0, 100)}`, error);
                return null;
              }
            });

            await Promise.all(batchPromises);

            // Rate limiting between batches
            if (i + BATCH_SIZE < validMemories.length) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          }

          console.log(
            `[${new Date().toISOString()}] Completed memory extraction. Created ${createdMemories} memories.`,
          );
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] Error in extract_document_essentials:`,
            error,
          );
          await generateFallbackContent(documentId, doc, spaceId, model, embedder, spaceOwnerId);
        }
      });

      console.log('done...');
      await finalize(documentId, 'done');
    } catch (err) {
      console.error('Processing failed', err);
      await finalize(documentId, 'failed', err as Error);
      throw err;
    }
  });
}

async function generateFallbackContent(
  documentId: string,
  doc: any,
  spaceId: string,
  model: any,
  embedder: any,
  ownerId: string = 'unknown',
) {
  console.log(
    `[${new Date().toISOString()}] Starting fallback content generation for document ${documentId}`,
  );

  try {
    // Simple fallback prompt for title and summary only
    const fallbackPrompt = `Provide a title (5-10 words) and summary (2-4 sentences) for this document.\n\nReturn as JSON: {"title": "...", "summary": "..."}\n\nDocument: ${doc.content.substring(0, 5000)}`;
    const { response } = await model.generateContent(fallbackPrompt);
    const text = response.text().trim();

    let title = 'Document';
    let summary = 'No summary available.';

    try {
      const parsed = JSON.parse(text);
      title = parsed.title || `Document - ${new Date().toISOString().split('T')[0]}`;
      summary = parsed.summary || 'Summary not available.';
    } catch {
      // If JSON parsing fails, extract title from first line and use raw text as summary
      const firstLine = doc.content.split('\n')[0]?.trim() || 'Document';
      title = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
      summary = text || 'Summary extraction failed.';
    }

    // Update document with encrypted fallback content
    await prisma.document.update({
      where: { id: documentId },
      data: {
        title: encrypt(title, ownerId),
        summary: encrypt(summary, ownerId)
      },
    });

    // Embed the summary (use plaintext for embedding)
    try {
      const emb = await embedder.embedContent(summary);
      await prisma.document.update({
        where: { id: documentId },
        data: {
          summaryEmbedding: JSON.stringify(emb.embedding.values),
          summaryEmbeddingModel: embeddingModelName(),
        },
      });
    } catch (embedError) {
      console.error('Failed to embed fallback summary:', embedError);
    }

    console.log(
      `[${new Date().toISOString()}] Fallback content generated for document ${documentId}`,
    );
  } catch (fallbackError) {
    console.error(
      `[${new Date().toISOString()}] Fallback also failed for document ${documentId}:`,
      fallbackError,
    );

    // Ultimate fallback - minimal document update (encrypted)
    await prisma.document.update({
      where: { id: documentId },
      data: {
        title: encrypt(`Document ${documentId.substring(0, 8)}`, ownerId),
        summary: encrypt('Content processing failed.', ownerId),
      },
    });
  }
}

async function extractText(documentId: string): Promise<{ text: string; type: string }> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { raw: true, metadata: true },
  });

  if (!doc || !doc.raw) return { text: '', type: 'text' };

  const raw: Buffer = doc.raw as Buffer;
  const md = doc.metadata as any;
  const mime = md?.sm_internal_fileType as string | undefined;

  try {
    if (mime?.includes('pdf')) {
      let standardFontDataUrl = path.join(
        path.dirname(require.resolve('pdfjs-dist/package.json')),
        'standard_fonts/',
      );

      // Convert Windows backslashes to forward slashes for pdfjs
      standardFontDataUrl = standardFontDataUrl.replace(/\\/g, '/');

      const parser = new PDFParse({ data: raw, standardFontDataUrl });
      const result = await parser.getText();

      return { text: result.text, type: 'text' };
    }

    // fallback for non-PDFs
    return { text: raw.toString('utf8'), type: 'text' };
  } catch (error) {
    console.error('Error extracting text:', error);
    return { text: '', type: 'text' };
  }
}
async function getDoc(documentId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
  });
  return doc;
}

async function step(documentId: string, name: string, fn: () => Promise<void>) {
  const start = Date.now();
  await appendStep(documentId, { name, startTime: start, status: 'pending' });
  try {
    await fn();
    await appendStep(documentId, {
      name,
      startTime: start,
      endTime: Date.now(),
      status: 'completed',
    });
    await prisma.document.update({
      where: { id: documentId },
      data: { status: name, updatedAt: new Date() },
    });
  } catch (e: any) {
    await appendStep(documentId, {
      name,
      startTime: start,
      endTime: Date.now(),
      status: 'failed',
      error: e?.message,
    });
    throw e;
  }
}

async function appendStep(documentId: string, step: any) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { processingMetadata: true },
  });

  const currentMetadata = (doc?.processingMetadata as any) || { steps: [] };
  const steps = currentMetadata.steps || [];

  await prisma.document.update({
    where: { id: documentId },
    data: {
      processingMetadata: {
        ...currentMetadata,
        steps: [...steps, step],
      },
    },
  });
}

async function finalize(documentId: string, finalStatus: 'done' | 'failed', err?: Error) {
  const end = Date.now();
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: finalStatus,
      processingMetadata: {
        endTime: end,
        finalStatus,
        error: err?.message,
      },
      updatedAt: new Date(),
    },
  });
}

function recursiveSplitter(content: string, target: number): string[] {
  const separators = [/(?<=\n\n+)/g, /(?<=[.!?]+\s+)/g, /(?<=[,;:]+\s+)/g, /(?<=\s+)/g];

  if (content.length <= target) {
    return content.trim() ? [content.trim()] : [];
  }

  let splitIndex = -1;
  // let bestSeparator = '';

  for (const separator of separators) {
    const matches = [...content.matchAll(separator)];
    for (const match of matches) {
      const index = match.index! + match[0].length;
      if (index > target * 0.7 && index < target * 1.3) {
        splitIndex = index;
        // bestSeparator = match[0];
        break;
      }
    }
    if (splitIndex !== -1) break;
  }

  if (splitIndex === -1) {
    splitIndex = target;
    const spaceIndex = content.lastIndexOf(' ', target);
    if (spaceIndex > target * 0.5) {
      splitIndex = spaceIndex + 1;
    }
  }

  const firstPart = content.slice(0, splitIndex).trim();
  const remaining = content.slice(splitIndex).trim();

  if (!firstPart) return recursiveSplitter(remaining, target);
  if (!remaining) return [firstPart];

  return [firstPart, ...recursiveSplitter(remaining, target)];
}

interface ChunkingOptions {
  targetSize?: number;
  overlap?: number;
  maxChunkSize?: number;
  minChunkSize?: number;
}

function semanticChunk(content: string, options: ChunkingOptions = {}): string[] {
  const { targetSize = 1200, overlap = 200, maxChunkSize = 1500, minChunkSize = 100 } = options;

  const chunks: string[] = [];
  const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  let currentChunk: string = '';
  let currentSize: number = 0;

  for (const paragraph of paragraphs) {
    const paragraphSize = paragraph.length;
    const trimmedParagraph = paragraph.trim();

    if (paragraphSize > maxChunkSize) {
      if (currentChunk && currentChunk.trim().length >= minChunkSize) {
        chunks.push(currentChunk.trim());
      }

      const paragraphChunks = recursiveSplitter(trimmedParagraph, targetSize);

      if (paragraphChunks.length > 0) {
        chunks.push(...paragraphChunks.slice(0, -1));
        currentChunk = paragraphChunks[paragraphChunks.length - 1] || '';
        currentSize = currentChunk.length;
      } else {
        currentChunk = '';
        currentSize = 0;
      }
      continue;
    }

    const newSize = currentSize + (currentSize > 0 ? 2 : 0) + paragraphSize;

    if (currentSize > 0 && newSize > maxChunkSize) {
      if (currentChunk.trim().length >= minChunkSize) {
        chunks.push(currentChunk.trim());

        const words = currentChunk.trim().split(/\s+/);
        let overlapText = '';
        let overlapSize = 0;

        for (let i = words.length - 1; i >= 0; i--) {
          const potentialText = words.slice(i).join(' ');
          if (potentialText.length <= overlap) {
            overlapText = potentialText;
            overlapSize = potentialText.length;
            break;
          }
        }

        currentChunk = overlapText || '';
        currentSize = overlapSize;
      } else {
        currentChunk = '';
        currentSize = 0;
      }
    }

    if (currentSize > 0) {
      currentChunk += '\n\n' + trimmedParagraph;
      currentSize += trimmedParagraph.length + 2;
    } else {
      currentChunk = trimmedParagraph;
      currentSize = trimmedParagraph.length;
    }
  }

  if (currentChunk.trim().length >= minChunkSize) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((chunk) => chunk.length >= minChunkSize);
}
