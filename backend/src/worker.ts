import { boss, JOB_PROCESS_DOCUMENT } from './queue'
import prisma from './db/prismaClient'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { embeddingModelName } from './gemini'
import { v4 as uuidv4 } from 'uuid'
import { PDFParse } from 'pdf-parse'
import path from 'path'
import { TaskType } from '@google/generative-ai';



import { createRequire } from 'module';
import { title } from 'process'
const require = createRequire(import.meta.url);

// If you need DOCX/CSV/MD parsing, import libraries (mammoth, papaparse, etc.)
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

interface ProcessDocumentJob {
  documentId: string
}

export async function registerWorkers() {
  console.log("reached here")
  await boss.work(JOB_PROCESS_DOCUMENT, async ([job]: any) => {
    console.log(`received job ${job.id}`)

    const { documentId } = job.data as ProcessDocumentJob
    try {

      await step(documentId, 'extracting', async () => {
        console.log("extracting")
        const { text, type } = await extractText(documentId)
        await prisma.document.update({
          where: { id: documentId },
          data: { content: text, type }
        })
      })

      await step(documentId, 'chunking', async () => {
        console.log("chunking")

        const doc = await getDoc(documentId)
        if (!doc?.content) {
          console.warn(`No content found for document at chunking ${documentId}`)
          return
        }

        const chunks = semanticChunk(doc.content, {
          targetSize: 1200,
          overlap: 200,
          maxChunkSize: 1500,
        });

        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        const averageChunkSize = chunks.length > 0
          ? Math.round(totalLength / chunks.length)
          : 0

        // Prepare batch data
        const chunkData = chunks.map((content, i) => ({
          id: uuidv4(),
          documentId,
          position: i,
          content: content || "",
          type: 'text',
        }))

        try {
          await prisma.$transaction(async (tx) => {
            // Delete existing chunks if reprocessing
            await tx.chunk.deleteMany({
              where: { documentId }
            })

            // Create all chunks
            await tx.chunk.createMany({
              data: chunkData,
            })

            // Update document
            await tx.document.update({
              where: { id: documentId },
              data: {
                chunkCount: chunks.length,
                averageChunkSize: averageChunkSize.toString(),
              }
            })
          })
        } catch (error) {
          console.error(`Chunking failed for document ${documentId}:`, error)
          throw error
        }
      })

      await step(documentId, 'embedding', async () => {
        console.log("embedding");

        const model = genAI.getGenerativeModel({
          model: embeddingModelName(),
        });

        const chunks = await prisma.chunk.findMany({
          where: { documentId },
          orderBy: { position: 'asc' }
        });

        if (chunks.length === 0) {
          console.log("No chunks to embed for document:", documentId);
          return;
        }

        try {
          // 1. Create a batch request for the Gemini API
          const requests = chunks.map(chunk => ({
            content: {
              role: 'user',
              parts: [{ text: chunk.content }]
            },
            taskType: "RETRIEVAL_DOCUMENT" as TaskType
          }));

          // The requests array needs to be passed as the value of a 'requests' property
          const result = await model.batchEmbedContents({ requests });

          const embeddings = result.embeddings;

          if (!embeddings || embeddings.length !== chunks.length) {
            throw new Error("Mismatch between chunk count and embedding count");
          }

          // 3. Prepare all database updates
          const updatePromises = chunks.map((chunk, i) => {
            const vector = embeddings[i]?.values;

            if (!vector) {
              console.warn(`No embedding returned for chunk ${chunk.id} (position ${chunk.position})`);
              return Promise.resolve(); // Skip this chunk
            }

            return prisma.chunk.update({
              where: { id: chunk.id },
              data: {
                embedding: JSON.stringify(vector),
                embeddingModel: embeddingModelName(),
              }
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

      await step(documentId, 'generate_summary_and_title', async () => {
        console.log("generate_summary_and_title")
        const doc = await getDoc(documentId)
        if (!doc?.content) {
          console.warn(`No content found for document at generate_summary_and_title ${documentId}`)
          return
        }
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

        // Generate both title and summary in one AI call for optimization
        const contentPreview = doc.content.substring(0, Math.min(doc.content.length, 3000))
        const prompt = `Analyze the document and provide both a descriptive title and summary in JSON format.
          Requirements:
          - Title: 3-8 words, descriptive, no generic terms like "document" or "file"
          - Summary: 2-4 sentences focusing on key facts, entities, and main topics
          - Consider document type (research paper, report, article, etc.) for appropriate tone
          - Handle edge cases: very short documents, technical content, mixed languages

          Return **only valid JSON**, with no markdown, explanation, or code block formatting.
          example format:
          {
            "title": "Your descriptive title here",
            "summary": "Your 2-4 sentence summary here"
          }

          Example for a research paper:
          {
            "title": "Machine Learning in Healthcare Applications",
            "summary": "This paper explores machine learning applications in healthcare, focusing on diagnostic algorithms and patient outcome prediction. Key findings demonstrate 95% accuracy in early disease detection using neural networks. The study covers implementation challenges and ethical considerations in medical AI systems."
          }

          Document content:
          ---
          ${contentPreview}`

        const { response } = await model.generateContent(prompt)
        const text = response.text().trim()

        try {
          const parsed = JSON.parse(text)
          const title = parsed.title?.trim()
          const summary = parsed.summary?.trim()

          if (title) {
            await prisma.document.update({
              where: { id: documentId },
              data: { title }
            })
          }

          if (summary) {
            await prisma.document.update({
              where: { id: documentId },
              data: { summary }
            })

            // Embed the summary
            const embedder = genAI.getGenerativeModel({ model: embeddingModelName() })
            const emb = await embedder.embedContent(summary)
            await prisma.document.update({
              where: { id: documentId },
              data: {
                summaryEmbedding: JSON.stringify(emb.embedding.values),
                summaryEmbeddingModel: embeddingModelName(),
              }
            })
          }
        } catch (parseError) {
          console.error('Failed to parse AI response as JSON:', text, parseError)
          // Fallback to original summary generation if JSON parsing fails
          const fallbackPrompt = `Summarize the following text in 2-4 sentences focusing on key facts and entities.\n\n---\n${doc.content}`
          const { response: fallbackResponse } = await model.generateContent(fallbackPrompt)
          const fallbackSummary = fallbackResponse.text().trim()
          await prisma.document.update({
            where: { id: documentId },
            data: { summary: fallbackSummary }
          })

          // Embed the fallback summary
          const embedder = genAI.getGenerativeModel({ model: embeddingModelName() })
          const emb = await embedder.embedContent(fallbackSummary)
          await prisma.document.update({
            where: { id: documentId },
            data: {
              summaryEmbedding: JSON.stringify(emb.embedding.values),
              summaryEmbeddingModel: embeddingModelName(),
            }
          })
        }
      })

      //TODO:need to give better prompt for getting good questions
      await step(documentId, 'generate_questions', async () => {
        console.log("generate_questions")
        const doc = await getDoc(documentId)
        if (!doc || !doc.content) return
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
        // const prompt = `From the document below, generate 5 common questions a user might ask.\nReturn strictly as a comma-separated list with no extra text.\n\n---\n${doc.content}`

        const prompt = `
          You are analyzing a extracted text content from a document.
          Your main goal is to remember the users information and preferences to make it useful later.
          To do this we need to create list memories out of the document.
          memories are short form,1 line sentence which can be used to remember information.
          to create such list of memories ,first you have to create list of questions which represents the questions to those memories.
          means the memories are the list of answers to those questions.

          Your task is to generate **clear and concise questions** that:
          - Would help retrive users preferences
          - Would help to get the most information of the user
          - Each question should be independent and self-contained.  

          Return **only** a comma-separated list of questions (no numbering, no explanations, no extra text).

          Example:
          If the document is about a resume of a user, good questions might be:
          "What is the users contact information?", "What is the users education?", "What is the users work experience?", "What is the users skills?", "What is the users interests?", "What is the users hobbies?"

          Document:
          ${doc.content}
        `
        const { response } = await model.generateContent(prompt)
        const csv = response.text().trim()
        const metadata = (doc.metadata || {}) as any
        metadata.commonQuestions = csv
        await prisma.document.update({
          where: { id: documentId },
          data: { metadata }
        })
      })

      await step(documentId, 'iterate_questions', async () => {
        console.log("iterate_questions")
        const doc = await getDoc(documentId)
        if (!doc) return
        const metadata = (doc.metadata || {}) as any
        const questions: string[] = typeof metadata.commonQuestions === 'string'
          ? metadata.commonQuestions.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []

        if (questions.length === 0) return

        // Recover the document's space to set spaceContainerTag and space_id
        const spaceRows = await prisma.documentsToSpaces.findMany({
          where: { documentId },
          include: { space: true }
        })
        const spaceId = spaceRows[0]?.spaceId

        const answerModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
        const embedder = genAI.getGenerativeModel({ model: embeddingModelName() })

        for (const q of questions) {
          //TODO:need to give better prompt for getting good formatted answers
          // const qPrompt = `Answer the question concisely using only the following document. If unknown, say "Unknown".\nQuestion: ${q}\n---\n${doc.content || ''}`
          const qPrompt = `
            You are building a **knowledge graph** from the following document.

            Your task is to answer the question using only the information in the document, and express the answer as a **single factual statement** that clearly represents a relationship or key fact.  

            Guidelines:
            - Use **subject–predicate–object** or **entity–relation–value** phrasing whenever possible.
            - Avoid adding extra context, explanations, or lists — each answer should be one atomic fact suitable for embedding as a memory node.
            - Use only explicit or strongly implied information from the document.
            - If the answer cannot be determined, reply exactly with "Unknown".
            - Keep the response short, factual, and self-contained.
            - The document text could have weird capitalization, so try to match the capitalization of the document.
            - The document text could have weird spacing, so try to match the spacing of the document.

            Example conversions:
            ❌ “It was founded in 2015.”  
            ✅ “Acme Corp was founded in 2015.”  
            ❌ “Yes, it is located in Paris.”  
            ✅ “Acme Corp's headquarters is located in Paris.”
            ❌ “email ainapureyash@gmail.com”  
            ✅ “{name}'s email is ainapureyash@gmail.com.”

            Question: ${q}

            Document:
            ${doc.content || ''}
          `
          const { response } = await answerModel.generateContent(qPrompt)
          const answer = response.text().trim()
          if (!answer || /^unknown$/i.test(answer)) continue

          // Create a memory that derives from this Q&A
          const memoryText = `${answer}`
          //here wee can add question:answer block or just the answer
          // const memoryText = `${q}: ${answer}`
          const emb = await embedder.embedContent(memoryText)
          const memoryId = uuidv4()

          //TODO: here we added derivesFrom commonquestion,this needs to be changed for better ones
          await prisma.memoryEntry.create({
            data: {
              id: memoryId,
              memory: memoryText,
              spaceId: spaceId!,
              orgId: doc.orgId,
              userId: doc.userId,
              version: 1,
              isLatest: true,
              isInference: true, // Mark as inference since it is derived from Q&A
              memoryEmbedding: JSON.stringify(emb.embedding.values),
              memoryEmbeddingModel: embeddingModelName(),
              metadata: { derivesFrom: 'commonQuestion' },
            },
          })

          await prisma.memoryDocumentSource.create({
            data: {
              memoryEntryId: memoryId,
              documentId,
              relevanceScore: 100,
            },
          })
        }
      })

      //TODO: currently iterate_questions and generate_memories create memories which could get repeated,we need to fix that.
      await step(documentId, 'generate_memories', async () => {
        console.log("generate_memories")
        const doc = await getDoc(documentId)
        if (!doc || !doc.content) return
        // Resolve the spaces for this document to set spaceContainerTag later
        const spaceRows = await prisma.documentsToSpaces.findMany({
          where: { documentId },
          include: { space: true }
        })
        const spaceId = spaceRows[0]?.spaceId

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
        const prompt = `Extract concise, user-relevant facts ("memories") from the following document.\nReturn JSON array of objects with keys: memory (string), isInference (boolean).\nDo not include any extra text.\n\n---\n${doc.content}`
        const { response } = await model.generateContent(prompt)
        const text = response.text()
        let items: Array<{ memory: string; isInference?: boolean }>
        try { items = JSON.parse(text) } catch { items = [] }

        const embedder = genAI.getGenerativeModel({ model: embeddingModelName() })
        for (const it of items) {
          if (!it.memory) continue
          const emb = await embedder.embedContent(it.memory)
          const memoryId = uuidv4()
          await prisma.memoryEntry.create({
            data: {
              id: memoryId,
              memory: it.memory,
              spaceId: spaceId!,
              orgId: doc.orgId,
              userId: doc.userId,
              version: 1,
              isLatest: true,
              isInference: it.isInference === true,
              memoryEmbedding: JSON.stringify(emb.embedding.values),
              memoryEmbeddingModel: embeddingModelName(),
            },
          })

          // Link memory to document (source)
          await prisma.memoryDocumentSource.create({
            data: {
              memoryEntryId: memoryId,
              documentId,
              relevanceScore: 100,
            },
          })
        }
      })


      await finalize(documentId, 'done')
    } catch (err) {
      console.error('Processing failed', err)
      await finalize(documentId, 'failed', err as Error)
      throw err
    }
  })
}

function chunk(content: string, target = 1200, overlap = 200) {
  const chunks: string[] = []
  let i = 0
  while (i < content.length) {
    const end = Math.min(content.length, i + target)
    chunks.push(content.slice(i, end))
    i = end - overlap
    if (i < 0) i = 0
    if (end === content.length) break
  }
  return chunks
}

async function extractText(documentId: string): Promise<{ text: string; type: string }> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { raw: true, metadata: true }
  })

  if (!doc || !doc.raw) return { text: '', type: 'text' }

  const raw: Buffer = doc.raw as Buffer
  const md = doc.metadata as any
  const mime = md?.sm_internal_fileType as string | undefined

  try {
    if (mime?.includes('pdf')) {
      const standardFontDataUrl = path.join(
        path.dirname(require.resolve('pdfjs-dist/package.json')),
        'standard_fonts/'
      );
      const parser = new PDFParse({ data: raw, standardFontDataUrl });
      const result = await parser.getText();

      return { text: result.text, type: 'text' }
    }
    // TODO: add DOCX/CSV/MD support via libraries (mammoth, papaparse, etc.)
    // Images: optionally call Gemini vision to OCR and summarize
    return { text: raw.toString('utf8'), type: 'text' }
  } catch (error) {
    console.error('Error extracting text:', error)
    return { text: '', type: 'text' }
  }
}

async function getDoc(documentId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId }
  })
  return doc
}

async function step(documentId: string, name: string, fn: () => Promise<void>) {
  const start = Date.now()
  await appendStep(documentId, { name, startTime: start, status: 'pending' })
  try {
    await fn()
    await appendStep(documentId, { name, startTime: start, endTime: Date.now(), status: 'completed' })
    await prisma.document.update({
      where: { id: documentId },
      data: { status: name, updatedAt: new Date() }
    })
  } catch (e: any) {
    await appendStep(documentId, { name, startTime: start, endTime: Date.now(), status: 'failed', error: e?.message })
    throw e
  }
}

async function appendStep(documentId: string, step: any) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { processingMetadata: true }
  })

  const currentMetadata = doc?.processingMetadata as any || { steps: [] }
  const steps = currentMetadata.steps || []

  await prisma.document.update({
    where: { id: documentId },
    data: {
      processingMetadata: {
        ...currentMetadata,
        steps: [...steps, step]
      }
    }
  })
}

async function finalize(documentId: string, finalStatus: 'done' | 'failed', err?: Error) {
  const end = Date.now()
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
    }
  })
}

function recursiveSplitter(
  content: string,
  target: number
): string[] {
  const separators = [
    /(?<=\n\n+)/g,
    /(?<=[.!?]+\s+)/g,
    /(?<=[,;:]+\s+)/g,
    /(?<=\s+)/g,
  ];

  if (content.length <= target) {
    return content.trim() ? [content.trim()] : [];
  }

  let splitIndex = -1;
  let bestSeparator = '';

  for (const separator of separators) {
    const matches = [...content.matchAll(separator)];
    for (const match of matches) {
      const index = match.index! + match[0].length;
      if (index > target * 0.7 && index < target * 1.3) {
        splitIndex = index;
        bestSeparator = match[0];
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

  return [
    firstPart,
    ...recursiveSplitter(remaining, target)
  ];
}


interface ChunkingOptions {
  targetSize?: number;
  overlap?: number;
  maxChunkSize?: number;
  minChunkSize?: number;
}

function semanticChunk(
  content: string,
  options: ChunkingOptions = {}
): string[] {
  const {
    targetSize = 1200,
    overlap = 200,
    maxChunkSize = 1500,
    minChunkSize = 100
  } = options;

  const chunks: string[] = [];
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);

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

  return chunks.filter(chunk => chunk.length >= minChunkSize);
}