# Implementing /v3/documents/file in Node.js + Express + Postgres (pgvector) + Gemini

This tutorial walks you through building the backend for the file upload and ingestion route used by your frontend: `POST /v3/documents/file`.

It is designed to match how your UI calls the route and what the rest of the app expects to read back from `GET /documents/documents`.

- Stack:
  - Node.js + Express
  - Postgres + pgvector (stores document, chunks, and memory vectors)
  - pg-boss (Postgres-backed job queue) for async processing
  - Google Gemini API (`@google/generative-ai`) for embeddings and LLM outputs (summary, questions, memories)

References in this repo:
- Frontend caller: `apps/web/components/views/add-memory/index.tsx` (file tab)
- Expected response shape: `route-responses/documents/documents.json`
- Validation schemas: `packages/validation/schemas.ts`, `packages/validation/api.ts`


## 1) Frontend contract (what the UI sends and expects)

From `apps/web/components/views/add-memory/index.tsx` (file tab):

- The UI sends a multipart/form-data POST to `${NEXT_PUBLIC_BACKEND_URL}/v3/documents/file`, with:
  - file: the uploaded file
  - containerTags: JSON stringified array, e.g. `"[\"sm_project_default\"]"`
- Credentials are included (cookies), so server should support session cookies.
- The UI expects the response JSON to include `id` of the created document. It then optionally calls `PATCH /v3/documents/:id` to update metadata (title/description).
- The UI shows success and closes the dialog; background processing continues. The listing view subsequently fetches documents, expecting:
  - A document object with fields like `id`, `status` (e.g., `queued`, `extracting`, `embedding`, `done`), `type`, `summary`, `summaryEmbeddingModel`, `metadata.commonQuestions`, etc.
  - Associated `memoryEntries` (each with its own embedding model, relations, and `spaceContainerTag` derived from container tags).

We will therefore:
- Return `{ id, status }` immediately from POST.
- Use a queue to parse the file, chunk, embed, summarize, generate questions, extract memories, embed them, and update the `documents` row to `status=done`.


## 2) Data model (Postgres)

We implement a normalized schema that maps cleanly to `DocumentSchema` and `DocumentWithMemoriesSchema` in `packages/validation`.

First, enable pgvector and create tables. Replace `VECTOR_DIM` with the dimension your Gemini embedding model outputs (768 for `text-embedding-004`; adjust if you use a different model).

```sql
-- 000_init.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;

-- For simple demos, store org/user as text. In prod, use proper FKs.
CREATE TABLE IF NOT EXISTS spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  container_tag TEXT UNIQUE,
  visibility TEXT DEFAULT 'private',
  is_experimental BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_id TEXT,
  content_hash TEXT,

  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  connection_id TEXT,

  title TEXT,
  content TEXT,
  summary TEXT,
  url TEXT,
  source TEXT,
  type TEXT DEFAULT 'text',
  status TEXT DEFAULT 'unknown',

  metadata JSONB,
  processing_metadata JSONB,
  raw BYTEA,
  og_image TEXT,

  token_count INT,
  word_count INT,
  chunk_count INT DEFAULT 0,
  average_chunk_size INT,

  summary_embedding vector(768),               -- set to your chosen model dim
  summary_embedding_model TEXT,
  summary_embedding_new vector(768),           -- optional
  summary_embedding_model_new TEXT,            -- optional

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents_to_spaces (
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, space_id)
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position INT NOT NULL,
  content TEXT NOT NULL,
  embedded_content TEXT,
  type TEXT DEFAULT 'text',
  metadata JSONB,
  embedding vector(768),
  embedding_model TEXT,
  embedding_new vector(768),
  embedding_new_model TEXT,
  matryoksha_embedding vector(768),
  matryoksha_embedding_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory TEXT NOT NULL,
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  user_id TEXT,

  version INT DEFAULT 1,
  is_latest BOOLEAN DEFAULT TRUE,
  parent_memory_id UUID,
  root_memory_id UUID,

  memory_relations JSONB DEFAULT '{}'::jsonb,
  source_count INT DEFAULT 1,

  is_inference BOOLEAN DEFAULT FALSE,
  is_forgotten BOOLEAN DEFAULT FALSE,
  forget_after TIMESTAMPTZ,
  forget_reason TEXT,

  memory_embedding vector(768),
  memory_embedding_model TEXT,
  memory_embedding_new vector(768),
  memory_embedding_new_model TEXT,

  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memory_document_sources (
  memory_entry_id UUID NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  relevance_score INT DEFAULT 100,
  metadata JSONB,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (memory_entry_id, document_id)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_pos ON document_chunks(document_id, position);
CREATE INDEX IF NOT EXISTS idx_memory_entries_space ON memory_entries(space_id);
```

Notes:
- `processing_metadata` stores step-by-step status and timing; it maps to `ProcessingMetadataSchema`.
- We keep vector dims at 768 to match Gemini `text-embedding-004`. Update if you use another model.


## 3) Environment and dependencies

Environment variables:

```bash
# .env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/supermemory
GEMINI_API_KEY=your_google_api_key
VECTOR_DIM=768
PORT=4000
```

Install dependencies:

```bash
npm i express multer zod uuid pg pg-format @google/generative-ai pg-boss mime-types dotenv cookie-parser cors pdf-parse
npm i -D ts-node typescript @types/express @types/multer @types/node
```

Optional parsers you may add later:

```bash
npm i mammoth papaparse remark remark-parse
```


## 4) Server skeleton and queue setup

`src/db.ts`:
```ts
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

export const pool = new Pool({ connectionString: process.env.DATABASE_URL })
```

`src/queue.ts` (pg-boss):
```ts
import PgBoss from 'pg-boss'
import dotenv from 'dotenv'

dotenv.config()

export const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL,
  schema: 'public',
})

export const JOB_PROCESS_DOCUMENT = 'process-document'

export async function startBoss() {
  await boss.start()
}
```

`src/gemini.ts`:
```ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config()

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export function embeddingModelName() {
  // Use 'text-embedding-004' (recommended). If you want to mirror sample output labels, use 'gemini-gemini-embedding-001'.
  return 'text-embedding-004'
}
```

`src/index.ts`:
```ts
import express from 'express'
import multer from 'multer'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import { boss, startBoss, JOB_PROCESS_DOCUMENT } from './queue'
import { pool } from './db'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'

dotenv.config()

const app = express()
app.use(cookieParser())
app.use(cors({ origin: true, credentials: true }))

// For PATCH/GET JSON routes
app.use(express.json({ limit: '2mb' }))

// Local file storage for demo purposes. Replace with S3/GCS in prod.
const uploadsDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir)
const upload = multer({ dest: uploadsDir })

// Very simple auth placeholders
function getAuth(req: express.Request) {
  // You likely have a session cookie. For now, just use demo IDs.
  const orgId = (req as any).orgId || 'demo_org'
  const userId = (req as any).userId || 'demo_user'
  return { orgId, userId }
}

const ContainerTagsSchema = z.string().transform((s) => {
  try { return JSON.parse(s) as string[] } catch { throw new Error('containerTags must be JSON array string') }
})

app.post('/v3/documents/file', upload.single('file'), async (req, res) => {
  try {
    const { orgId, userId } = getAuth(req)
    const { file } = req
    if (!file) return res.status(400).json({ error: 'file is required' })

    const containerTags = req.body.containerTags
      ? ContainerTagsSchema.parse(req.body.containerTags)
      : ['sm_project_default']

    // Ensure spaces exist for each containerTag
    const spaceIds: string[] = []
    for (const tag of containerTags) {
      const { rows } = await pool.query(
        `INSERT INTO spaces (id, org_id, owner_id, container_tag)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (container_tag) DO UPDATE SET container_tag = EXCLUDED.container_tag
         RETURNING id`,
        [uuidv4(), orgId, userId, tag],
      )
      spaceIds.push(rows[0].id)
    }

    // Insert document stub with status queued
    const id = uuidv4()
    const type = inferTypeFromMime(file.mimetype)
    const metadata = {
      sm_internal_fileName: file.originalname,
      sm_internal_fileSize: file.size,
      sm_internal_fileType: file.mimetype,
    }

    await pool.query(
      `INSERT INTO documents (id, org_id, user_id, title, type, status, metadata, processing_metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())`,
      [id, orgId, userId, file.originalname, type, 'queued', metadata, JSON.stringify({ startTime: Date.now(), steps: [] })],
    )

    for (const spaceId of spaceIds) {
      await pool.query(
        `INSERT INTO documents_to_spaces (document_id, space_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, spaceId],
      )
    }

    // Store raw file bytes (optional). For large files prefer object storage.
    const raw = fs.readFileSync(file.path)
    await pool.query('UPDATE documents SET raw = $1 WHERE id = $2', [raw, id])

    // Enqueue processing job
    await boss.publish(JOB_PROCESS_DOCUMENT, { documentId: id, containerTags, mimetype: file.mimetype })

    // Respond immediately
    return res.status(200).json({ id, status: 'queued' })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: err.message || 'Upload failed' })
  }
})

// Optional: PATCH to update metadata (used by frontend when title/description provided)
app.patch('/v3/documents/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { metadata } = req.body || {}
    await pool.query('UPDATE documents SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = now() WHERE id = $2', [JSON.stringify(metadata || {}), id])
    const { rows } = await pool.query('SELECT id, status FROM documents WHERE id = $1', [id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    return res.json(rows[0])
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: err.message || 'Update failed' })
  }
})

function inferTypeFromMime(mime: string) {
  if (mime.includes('pdf')) return 'pdf'
  if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'text' // doc/docx => text after conversion
  if (mime.startsWith('image/')) return 'image'
  if (mime.includes('csv')) return 'text'
  if (mime.includes('json')) return 'text'
  if (mime.includes('markdown') || mime.includes('text')) return 'text'
  return 'text'
}

const port = Number(process.env.PORT || 4000)
startBoss().then(() => app.listen(port, () => console.log(`API listening on :${port}`)))
```


## 5) The processing worker (parse → chunk → embed → summarize → questions → memories)

`src/worker.ts`:
```ts
import { boss, JOB_PROCESS_DOCUMENT } from './queue'
import { pool } from './db'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { embeddingModelName } from './gemini'
import { v4 as uuidv4 } from 'uuid'
import pdfParse from 'pdf-parse'
import fs from 'fs'

// If you need DOCX/CSV/MD parsing, import libraries (mammoth, papaparse, etc.)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function registerWorkers() {
  await boss.work(JOB_PROCESS_DOCUMENT, async (job) => {
    const { documentId } = job.data as { documentId: string; containerTags: string[]; mimetype: string }
    try {
      await step(documentId, 'extracting', async () => {
        const { text, type } = await extractText(documentId)
        await pool.query('UPDATE documents SET content = $1, type = $2 WHERE id = $3', [text, type, documentId])
      })

      await step(documentId, 'chunking', async () => {
        const doc = await getDoc(documentId)
        const chunks = chunk(doc.content || '')
        for (let i = 0; i < chunks.length; i++) {
          await pool.query(
            `INSERT INTO document_chunks (id, document_id, position, content, type) VALUES ($1, $2, $3, $4, 'text')`,
            [uuidv4(), documentId, i, chunks[i]],
          )
        }
        await pool.query('UPDATE documents SET chunk_count = $1, average_chunk_size = $2 WHERE id = $3', [
          chunks.length,
          Math.round(chunks.reduce((a, c) => a + c.length, 0) / Math.max(1, chunks.length)),
          documentId,
        ])
      })

      await step(documentId, 'embedding', async () => {
        const model = genAI.getGenerativeModel({ model: embeddingModelName() })
        const { rows } = await pool.query('SELECT id, content FROM document_chunks WHERE document_id = $1 ORDER BY position', [documentId])
        for (const row of rows) {
          const result = await model.embedContent(row.content)
          const vector = result.embedding.values
          await pool.query(
            `UPDATE document_chunks SET embedding = $1, embedding_model = $2 WHERE id = $3`,
            [vector, embeddingModelName(), row.id],
          )
        }
      })

      await step(documentId, 'generate_summary', async () => {
        const doc = await getDoc(documentId)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
        const prompt = `Summarize the following text in 2-4 sentences focusing on key facts and entities.\n\n---\n${doc.content || ''}`
        const { response } = await model.generateContent(prompt)
        const summary = response.text().trim()
        await pool.query('UPDATE documents SET summary = $1 WHERE id = $2', [summary, documentId])

        // Embed the summary
        const embedder = genAI.getGenerativeModel({ model: embeddingModelName() })
        const emb = await embedder.embedContent(summary)
        await pool.query(
          'UPDATE documents SET summary_embedding = $1, summary_embedding_model = $2 WHERE id = $3',
          [emb.embedding.values, embeddingModelName(), documentId],
        )
      })

      await step(documentId, 'generate_questions', async () => {
        const doc = await getDoc(documentId)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
        const prompt = `From the document below, generate 5 common questions a user might ask.\nReturn strictly as a comma-separated list with no extra text.\n\n---\n${doc.content || ''}`
        const { response } = await model.generateContent(prompt)
        const csv = response.text().trim()
        const metadata = (doc.metadata || {}) as any
        metadata.commonQuestions = csv
        await pool.query('UPDATE documents SET metadata = $1 WHERE id = $2', [JSON.stringify(metadata), documentId])
      })

      // Optional but recommended: iterate through the generated questions to extract more targeted memories
      await step(documentId, 'iterate_questions', async () => {
        const doc = await getDoc(documentId)
        const metadata = (doc.metadata || {}) as any
        const questions: string[] = typeof metadata.commonQuestions === 'string'
          ? metadata.commonQuestions.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []

        if (questions.length === 0) return

        // Recover the document's space to set spaceContainerTag and space_id
        const spaceRows = await pool.query(
          `SELECT s.id, s.container_tag FROM spaces s
           JOIN documents_to_spaces ds ON ds.space_id = s.id
           WHERE ds.document_id = $1`,
          [documentId],
        )
        const spaceId = spaceRows.rows[0]?.id

        const answerModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })
        const embedder = genAI.getGenerativeModel({ model: embeddingModelName() })

        for (const q of questions) {
          // Ask the model to answer concisely using only the document’s content
          const qPrompt = `Answer the question concisely using only the following document. If unknown, say "Unknown".\nQuestion: ${q}\n---\n${doc.content || ''}`
          const { response } = await answerModel.generateContent(qPrompt)
          const answer = response.text().trim()
          if (!answer || /^unknown$/i.test(answer)) continue

          // Create a memory that derives from this Q&A
          const memoryText = `${q}: ${answer}`
          const emb = await embedder.embedContent(memoryText)
          const memoryId = uuidv4()

          await pool.query(
            `INSERT INTO memory_entries (
              id, memory, space_id, org_id, user_id, version, is_latest,
              is_inference, memory_embedding, memory_embedding_model, metadata
            ) VALUES ($1, $2, $3, $4, $5, 1, TRUE, $6, $7, $8, $9)`,
            [
              memoryId,
              memoryText,
              spaceId,
              doc.org_id,
              doc.user_id,
              true, // Mark as inference since it is derived from Q&A
              emb.embedding.values,
              embeddingModelName(),
              { derivesFrom: 'commonQuestion' },
            ],
          )

          await pool.query(
            `INSERT INTO memory_document_sources (memory_entry_id, document_id, relevance_score)
             VALUES ($1, $2, 100) ON CONFLICT DO NOTHING`,
            [memoryId, documentId],
          )
        }
      })

      await step(documentId, 'generate_memories', async () => {
        const doc = await getDoc(documentId)
        // Resolve the spaces for this document to set spaceContainerTag later
        const spaceRows = await pool.query(
          `SELECT s.id, s.container_tag FROM spaces s
           JOIN documents_to_spaces ds ON ds.space_id = s.id
           WHERE ds.document_id = $1`,
          [documentId],
        )
        const spaceId = spaceRows.rows[0]?.id
        const spaceContainerTag = spaceRows.rows[0]?.container_tag

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })
        const prompt = `Extract concise, user-relevant facts ("memories") from the following document.\nReturn JSON array of objects with keys: memory (string), isInference (boolean).\nDo not include any extra text.\n\n---\n${doc.content || ''}`
        const { response } = await model.generateContent(prompt)
        const text = response.text()
        let items: Array<{ memory: string; isInference?: boolean }>
        try { items = JSON.parse(text) } catch { items = [] }

        const embedder = genAI.getGenerativeModel({ model: embeddingModelName() })
        for (const it of items) {
          if (!it.memory) continue
          const emb = await embedder.embedContent(it.memory)
          const memoryId = uuidv4()
          await pool.query(
            `INSERT INTO memory_entries (
              id, memory, space_id, org_id, user_id, version, is_latest,
              is_inference, memory_embedding, memory_embedding_model, metadata
            ) VALUES ($1, $2, $3, $4, $5, 1, TRUE, $6, $7, $8, $9)`,
            [
              memoryId,
              it.memory,
              spaceId,
              doc.org_id,
              doc.user_id,
              it.isInference === true,
              emb.embedding.values,
              embeddingModelName(),
              null,
            ],
          )

          // Link memory to document (source)
          await pool.query(
            `INSERT INTO memory_document_sources (memory_entry_id, document_id, relevance_score)
             VALUES ($1, $2, 100) ON CONFLICT DO NOTHING`,
            [memoryId, documentId],
          )
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
  const { rows } = await pool.query('SELECT raw, metadata FROM documents WHERE id = $1', [documentId])
  const raw: Buffer | null = rows[0]?.raw
  const md = rows[0]?.metadata || {}
  if (!raw) return { text: '', type: 'text' }
  const mime = md?.sm_internal_fileType as string | undefined

  if (mime?.includes('pdf')) {
    const parsed = await pdfParse(raw)
    return { text: parsed.text || '', type: 'pdf' }
  }
  // TODO: add DOCX/CSV/MD support via libraries (mammoth, papaparse, etc.)
  // Images: optionally call Gemini vision to OCR and summarize
  return { text: raw.toString('utf8'), type: 'text' }
}

async function getDoc(documentId: string) {
  const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [documentId])
  return rows[0]
}

async function step(documentId: string, name: string, fn: () => Promise<void>) {
  const start = Date.now()
  await appendStep(documentId, { name, startTime: start, status: 'pending' })
  try {
    await fn()
    await appendStep(documentId, { name, startTime: start, endTime: Date.now(), status: 'completed' })
    await pool.query('UPDATE documents SET status = $1, updated_at = now() WHERE id = $2', [name, documentId])
  } catch (e: any) {
    await appendStep(documentId, { name, startTime: start, endTime: Date.now(), status: 'failed', error: e?.message })
    throw e
  }
}

async function appendStep(documentId: string, step: any) {
  await pool.query(
    `UPDATE documents SET processing_metadata = COALESCE(processing_metadata, jsonb_build_object('steps', '[]'::jsonb)) ||
     jsonb_build_object('steps', (COALESCE(processing_metadata->'steps', '[]'::jsonb) || to_jsonb($1::jsonb)))
     WHERE id = $2`,
    [JSON.stringify(step), documentId],
  )
}

async function finalize(documentId: string, finalStatus: 'done' | 'failed', err?: Error) {
  const end = Date.now()
  await pool.query(
    `UPDATE documents
     SET status = $1,
         processing_metadata = (COALESCE(processing_metadata, '{}'::jsonb) || to_jsonb($2::jsonb)),
         updated_at = now()
     WHERE id = $3`,
    [finalStatus, { endTime: end, finalStatus, error: err?.message }, documentId],
  )
}
```

Wire the worker at startup (add to `src/index.ts` bottom):
```ts
import { registerWorkers } from './worker'
registerWorkers()
```


## 6) Mapping to your UI and response shape

- Immediately after POST, UI gets `{ id, status: 'queued' }` and may PATCH metadata.
- The list view later fetches documents and expects fields similar to `route-responses/documents/documents.json`:
  - `status` transitions across steps and finally `done`.
  - `summary`, `summaryEmbedding`, and `summaryEmbeddingModel` are filled.
  - `metadata.commonQuestions` contains a comma-separated list.
  - `memoryEntries` are available via a join in the `GET /documents/documents` route (not covered here). We already populate `memory_entries` and link them via `memory_document_sources`, as well as `documents_to_spaces` → `spaces` to recover `spaceContainerTag`.

To fully match `DocumentWithMemoriesSchema` for the list route, your `SELECT` can follow `packages/validation/api.ts` (see `DocumentWithMemoriesSchema`), shaping the joined result accordingly.


## 7) Prompts used for LLM steps

- Summary (fast, cheap): `gemini-1.5-flash` with 2–4 sentence summary.
- Questions: `gemini-1.5-flash`, return CSV only.
- Memories (more accurate): `gemini-1.5-pro`, return JSON array of `{ memory: string, isInference: boolean }`.
- Embeddings for chunks, summary, memories: `text-embedding-004` (768 dims). Store model name in `*_model` fields.

You can switch to match the labels you saw in sample data (e.g., `gemini-gemini-embedding-001`) by swapping `embeddingModelName()`.


## 8) Error handling, retries, and observability

- pg-boss lets you set retry attempts and backoff when publishing or defining the worker.
- Each step updates `processing_metadata.steps[]` with timing and outcome; `finalize()` marks `finalStatus` and updates document `status`.
- Consider timeouts and truncation for very large files.


## 9) Security and constraints

- Enforce max file size in `multer` and restrict accepted MIME types.
- Validate `containerTags` ownership and limit the number of tags.
- Prefer object storage (S3/GCS) over DB bytea for large files.
- Keep `VECTOR_DIM` consistent between DB schema and chosen embedding model.


## 10) Testing the route

Upload a file:
```bash
curl -i -X POST \
  -H "Cookie: session=..." \
  -F "file=@/path/to/file.pdf" \
  -F 'containerTags=["sm_project_default"]' \
  http://localhost:4000/v3/documents/file
```

Update metadata:
```bash
curl -i -X PATCH \
  -H 'Content-Type: application/json' \
  -d '{"metadata": {"title": "My Resume", "description": "2025 edition", "sm_source": "consumer"}}' \
  http://localhost:4000/v3/documents/<docId>
```


## 11) Next routes to implement (out of scope here)

- `GET /v3/documents/:id` — used by note/link flow polling. Return at least `{ id, status, content }`.
- `GET /v3/documents/documents` — list with joins to include `memoryEntries[]` (shape in `packages/validation/api.ts`), filtering by `containerTags`.

These two will let the UI fully reflect processing progress and render memory entries like the sample at `route-responses/documents/documents.json`.


## 12) Checklist against the UI and sample data

- Accepts `file`+`containerTags` exactly as in `AddMemoryView` file tab.
- Returns `{ id, status }` so UI can PATCH metadata.
- Asynchronously produces:
  - `summary` and `summary_embedding` with model name.
  - `metadata.commonQuestions`.
  - `iterate_questions`: optional step that loops over `commonQuestions`, generates concise Q&A-based memories, and stores them marked with `is_inference=true` and a derivation note in `metadata` (you can expand this to populate `memory_relations`).
  - `document_chunks` with embeddings.
  - `memory_entries` with embeddings and linkage via `memory_document_sources` and `spaces` (so you can compute `spaceContainerTag`).
  - `processing_metadata` with step timings and final status.
- Status transitions: `queued → extracting → chunking → embedding → generate_summary → generate_questions → generate_memories → done`.

This gives you a production-ready baseline for `/v3/documents/file` aligned to your frontend’s expectations and the document shape visible in `documents.json`.
