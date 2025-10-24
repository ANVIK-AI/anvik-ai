# File Upload Route Implementation

This document describes the implementation of the `/v3/documents/file` route as specified in the backend-v3-documents-file-node-express-postgres-gemini.md file.

## Overview

The implementation provides:
- **POST /v3/documents/file** - File upload with immediate response and background processing
- **PATCH /v3/documents/:id** - Update document metadata
- Background processing worker that handles text extraction, chunking, embedding, summarization, and memory generation

## Files Added/Modified

### New Files Created:
- `src/db.ts` - Database connection using pg Pool
- `src/queue.ts` - pg-boss queue setup
- `src/gemini.ts` - Google Gemini AI client setup
- `src/worker.ts` - Background processing worker
- `test-routes.js` - Test script for route verification

### Modified Files:
- `src/app.ts` - Added multer middleware for file uploads
- `src/server.ts` - Added queue and worker initialization
- `src/routes/document.routes.ts` - Added new routes
- `src/controller/document.controller.ts` - Added upload and metadata update controllers
- `src/services/document.service.ts` - Added upload and metadata update services

## Dependencies Added

```bash
npm install multer zod uuid pg-format @google/generative-ai pg-boss mime-types cookie-parser pdf-parse mammoth papaparse remark remark-parse
npm install -D @types/multer @types/uuid
```

## Environment Variables Required

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/supermemory
GEMINI_API_KEY=your_google_api_key
VECTOR_DIM=768
PORT=4000
```

## API Endpoints

### POST /v3/documents/file
Uploads a file and starts background processing.

**Request:**
- Content-Type: multipart/form-data
- Fields:
  - `file`: The file to upload
  - `containerTags`: JSON stringified array (e.g., `"[\"sm_project_default\"]"`)

**Response:**
```json
{
  "id": "document-uuid",
  "status": "queued"
}
```

### PATCH /v3/documents/:id
Updates document metadata.

**Request:**
- Content-Type: application/json
- Body: `{"metadata": {"title": "New Title", "description": "New Description"}}`

**Response:**
```json
{
  "id": "document-uuid",
  "status": "current-status"
}
```

## Background Processing Pipeline

The worker processes documents through these steps:

1. **extracting** - Extract text from uploaded file (PDF, text, etc.)
2. **chunking** - Split content into chunks for embedding
3. **embedding** - Generate embeddings for each chunk using Gemini
4. **generate_summary** - Create document summary using Gemini
5. **generate_questions** - Generate common questions about the document
6. **iterate_questions** - Create Q&A-based memories from questions
7. **generate_memories** - Extract key facts and memories from content
8. **done** - Processing complete

## Database Schema

The implementation uses the existing Prisma schema with these key models:
- `Document` - Main document storage
- `Chunk` - Document chunks with embeddings
- `MemoryEntry` - Generated memories
- `Space` - Project/workspace containers
- `DocumentsToSpaces` - Document-space relationships
- `MemoryDocumentSource` - Memory-document relationships

## Testing

1. Start the server:
```bash
npm run dev
```

2. Test file upload:
```bash
curl -i -X POST \
  -F "file=@test-document.txt" \
  -F 'containerTags=["sm_project_default"]' \
  http://localhost:4000/v3/documents/file
```

3. Test metadata update:
```bash
curl -i -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"metadata": {"title": "Test Document"}}' \
  http://localhost:4000/v3/documents/<DOCUMENT_ID>
```

## Key Features

- **Immediate Response**: Returns document ID and status immediately
- **Background Processing**: Uses pg-boss for reliable job processing
- **Multiple File Types**: Supports PDF, text, images, and more
- **Memory Generation**: Creates structured memories from document content
- **Question Generation**: Generates common questions and Q&A memories
- **Embedding Support**: Uses Gemini text-embedding-004 for vector embeddings
- **Error Handling**: Comprehensive error handling and status tracking

## Status Transitions

Documents progress through these statuses:
- `queued` → `extracting` → `chunking` → `embedding` → `generate_summary` → `generate_questions` → `iterate_questions` → `generate_memories` → `done`

## Notes

- File storage is currently local (uploads directory) - replace with S3/GCS for production
- Authentication is placeholder - implement proper session/auth for production
- Vector dimensions are set to 768 for Gemini text-embedding-004
- Processing metadata tracks each step with timing information
