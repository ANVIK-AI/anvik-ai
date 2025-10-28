import { boss, JOB_PROCESS_DOCUMENT } from './queue'
import prisma from './db/prismaClient'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { embeddingModelName } from './gemini'
import { v4 as uuidv4 } from 'uuid'
import { PDFParse } from 'pdf-parse'
import path from 'path'


import { createRequire } from 'module';
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
    console.log(`received job ${job.id} with data ${JSON.stringify(job.data)}`)

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
        if (!doc || !doc.content) return
        const chunks = chunk(doc.content)
        for (let i = 0; i < chunks.length; i++) {
          await prisma.chunk.create({
            data: {
              id: uuidv4(),
              documentId,
              position: i,
              content: chunks[i] || "",
              type: 'text',
            },
          })
        }
        await prisma.document.update({
          where: { id: documentId },
          data: {
            chunkCount: chunks.length,
            averageChunkSize: chunks.length > 0 ? Math.round(chunks.reduce((a, c) => a + c.length, 0) / chunks.length).toString() : '0',
          }
        })
      })

      await step(documentId, 'embedding', async () => {
        console.log("embedding")
        const model = genAI.getGenerativeModel({
          model: embeddingModelName(),
        })
        const chunks = await prisma.chunk.findMany({
          where: { documentId },
          orderBy: { position: 'asc' }
        })
        for (const chunk of chunks) {
          const result = await model.embedContent(chunk.content)
          const vector = result.embedding.values
          await prisma.chunk.update({
            where: { id: chunk.id },
            data: {
              embedding: JSON.stringify(vector),
              embeddingModel: embeddingModelName(),
            }
          })
        }
      })

      await step(documentId, 'generate_summary', async () => {
        console.log("generate_summary")
        const doc = await getDoc(documentId)
        if (!doc || !doc.content) return
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
        const prompt = `Summarize the following text in 2-4 sentences focusing on key facts and entities.\n\n---\n${doc.content}`
        const { response } = await model.generateContent(prompt)
        const summary = response.text().trim()
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
      })

      //TODO:need to give better prompt for getting good questions
      await step(documentId, 'generate_questions', async () => {
        console.log("generate_questions")
        const doc = await getDoc(documentId)
        if (!doc || !doc.content) return
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
        const prompt = `From the document below, generate 5 common questions a user might ask.\nReturn strictly as a comma-separated list with no extra text.\n\n---\n${doc.content}`
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
          const qPrompt = `Answer the question concisely using only the following document. If unknown, say "Unknown".\nQuestion: ${q}\n---\n${doc.content || ''}`
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

