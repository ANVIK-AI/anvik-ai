# Understanding Closed-Source Memory System Implementation

Based on the analysis of your current backend structure and the original API response, here's how the closed-source project likely implements document and memory creation, relationship establishment, and embedding generation.

## Document Creation Pipeline

### 1. Document Ingestion Process

The system follows a multi-stage document processing pipeline:

```typescript
// Document creation stages
enum DocumentStatus {
  QUEUED = "queued",
  EXTRACTING = "extracting", 
  CHUNKING = "chunking",
  EMBEDDING = "embedding",
  INDEXING = "indexing",
  DONE = "done",
  FAILED = "failed"
}
```

### 2. Content Extraction

Documents are processed through different extractors based on type:

```typescript
// Example extraction service
class DocumentExtractor {
  async extractContent(document: Document): Promise<ExtractedContent> {
    switch (document.type) {
      case 'pdf':
        return this.extractFromPDF(document.raw);
      case 'webpage':
        return this.extractFromWebpage(document.url);
      case 'text':
        return this.extractFromText(document.content);
      // ... other types
    }
  }

  async extractFromPDF(pdfBuffer: Buffer): Promise<ExtractedContent> {
    // Use PDF parsing libraries (pdf-parse, pdf2pic, etc.)
    const text = await pdfParse(pdfBuffer);
    const metadata = await this.extractPDFMetadata(pdfBuffer);

    return {
      content: text.text,
      title: metadata.title,
      metadata: { ...metadata, pageCount: text.numpages }
    };
  }
}
```

## Memory Generation Process

### 1. Memory Extraction from Content

The system uses AI to generate memories from document content:

```typescript
class MemoryGenerator {
  async generateMemories(document: Document, content: string): Promise<MemoryEntry[]> {
    // 1. Generate AI questions to extract key information
    const questions = await this.generateQuestions(content);

    // 2. Use questions to extract specific memories
    const memories = [];
    for (const question of questions) {
      const answer = await this.answerQuestion(content, question);
      if (answer.confidence > 0.7) {
        memories.push({
          memory: answer.text,
          metadata: {
            question: question,
            confidence: answer.confidence,
            extractionMethod: "ai-generated"
          }
        });
      }
    }

    return memories;
  }

  private async generateQuestions(content: string): Promise<string[]> {
    // Use LLM to generate relevant questions
    const prompt = `
      Given this content, generate 5-10 specific questions that would extract
      the most important factual information, key concepts, and relationships.
      Focus on questions that would create useful, searchable memories.

      Content: ${content.substring(0, 4000)}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    });

    return this.parseQuestions(response.choices[0].message.content);
  }
}
```

### 2. Memory Version Control

Each memory entry has built-in version control:

```typescript
// Memory relationships structure
interface MemoryRelations {
  parentMemoryId?: string;
  rootMemoryId?: string;
  version: number;
  relations: {
    updates?: string[];    // Memory IDs this memory updates
    extends?: string[];    // Memory IDs this memory extends
    derives?: string[];    // Memory IDs derived from this memory
  };
}

// Creating a new memory version
async function createMemoryVersion(
  originalMemory: MemoryEntry,
  newContent: string,
  relationType: 'updates' | 'extends' | 'derives'
): Promise<MemoryEntry> {
  // Mark original as not latest
  await prisma.memoryEntry.update({
    where: { id: originalMemory.id },
    data: { isLatest: false }
  });

  // Create new version
  const newMemory = await prisma.memoryEntry.create({
    data: {
      memory: newContent,
      spaceId: originalMemory.spaceId,
      orgId: originalMemory.orgId,
      parentMemoryId: originalMemory.id,
      rootMemoryId: originalMemory.rootMemoryId || originalMemory.id,
      version: originalMemory.version + 1,
      isLatest: true,
      memoryRelations: {
        [relationType]: [originalMemory.id],
        ...originalMemory.memoryRelations
      }
    }
  });

  return newMemory;
}
```

## Document-Memory Relationship Establishment

### 1. Relevance Scoring

When creating memory-document relationships, the system calculates relevance:

```typescript
class RelevanceScorer {
  async calculateRelevance(memory: MemoryEntry, document: Document): Promise<number> {
    // Method 1: Semantic similarity using embeddings
    if (memory.memoryEmbedding && document.summaryEmbedding) {
      const similarity = this.cosineSimilarity(
        memory.memoryEmbedding,
        document.summaryEmbedding
      );
      return Math.round(similarity * 100);
    }

    // Method 2: Keyword overlap
    const memoryKeywords = this.extractKeywords(memory.memory);
    const documentKeywords = this.extractKeywords(document.content || '');

    const overlap = this.calculateOverlap(memoryKeywords, documentKeywords);
    return Math.round(overlap * 100);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    return dotProduct / (normA * normB);
  }
}
```

### 2. Relationship Creation

The system creates bidirectional relationships:

```typescript
// Service to establish document-memory relationships
class DocumentMemoryService {
  async establishRelationships(document: Document, memories: MemoryEntry[]): Promise<void> {
    const relationships = [];

    for (const memory of memories) {
      // Calculate relevance score
      const relevanceScore = await this.relevanceScorer.calculateRelevance(memory, document);

      // Only create relationship if relevant enough
      if (relevanceScore >= 50) {
        relationships.push({
          memoryEntryId: memory.id,
          documentId: document.id,
          relevanceScore,
          metadata: {
            relationshipType: 'extracted',
            createdAt: new Date(),
            extractionMethod: 'ai-generated'
          }
        });
      }
    }

    // Bulk create relationships
    await prisma.memoryDocumentSource.createMany({
      data: relationships
    });
  }
}
```

## Embedding Generation Strategy

### 1. Multi-Model Embedding Support

The system supports multiple embedding models for comparison:

```typescript
class EmbeddingService {
  async generateDocumentEmbedding(document: Document): Promise<{
    summaryEmbedding: number[];
    model: string;
  }> {
    const textToEmbed = this.prepareDocumentText(document);

    // Try multiple models for better results
    const models = [
      'gemini-embedding-001',
      'text-embedding-ada-002',
      'text-embedding-3-small'
    ];

    const results = await Promise.allSettled(
      models.map(model => this.generateEmbedding(textToEmbed, model))
    );

    // Use the most successful result
    const successfulResult = results.find(r => r.status === 'fulfilled');
    if (successfulResult) {
      return successfulResult.value;
    }

    throw new Error('All embedding models failed');
  }

  async generateMemoryEmbedding(memory: MemoryEntry): Promise<{
    memoryEmbedding: number[];
    model: string;
  }> {
    // Similar logic for memory embeddings
    const textToEmbed = memory.memory;

    return this.generateEmbedding(textToEmbed, 'gemini-embedding-001');
  }

  private async generateEmbedding(text: string, model: string): Promise<{
    embedding: number[];
    model: string;
  }> {
    // Implementation depends on the embedding provider
    switch (model) {
      case 'gemini-embedding-001':
        return this.callGeminiEmbedding(text);
      case 'text-embedding-ada-002':
        return this.callOpenAIEmbedding(text, model);
      // ... other providers
    }
  }
}
```

### 2. Batch Processing and Queues

For performance, embeddings are processed in batches:

```typescript
class EmbeddingQueue {
  async processEmbeddingQueue(): Promise<void> {
    const pendingDocuments = await prisma.document.findMany({
      where: {
        status: 'embedding',
        summaryEmbedding: null
      },
      take: 10 // Process in batches
    });

    for (const document of pendingDocuments) {
      try {
        const embedding = await this.embeddingService.generateDocumentEmbedding(document);

        await prisma.document.update({
          where: { id: document.id },
          data: {
            summaryEmbedding: JSON.stringify(embedding.embedding),
            summaryEmbeddingModel: embedding.model,
            status: 'indexing'
          }
        });
      } catch (error) {
        await this.handleEmbeddingError(document, error);
      }
    }
  }
}
```

## Advanced Memory Relationship Patterns

### 1. Temporal Memory Chains

The system creates chains of related memories over time:

```typescript
// Example of memory evolution
const memoryChain = [
  {
    id: "mem_1",
    memory: "John is working on a new project",
    version: 1,
    createdAt: "2024-01-01"
  },
  {
    id: "mem_2",
    memory: "John's project is about AI integration",
    version: 2,
    parentMemoryId: "mem_1",
    createdAt: "2024-01-15"
  },
  {
    id: "mem_3",
    memory: "John successfully integrated AI into the project",
    version: 3,
    parentMemoryId: "mem_2",
    createdAt: "2024-02-01"
  }
];
```

### 2. Cross-Document Memory Linking

Memories from different documents can be linked:

```typescript
class MemoryLinker {
  async findRelatedMemories(memory: MemoryEntry): Promise<MemoryEntry[]> {
    // Find memories with similar embeddings
    const similarMemories = await prisma.memoryEntry.findMany({
      where: {
        NOT: { id: memory.id },
        memoryEmbedding: {
          // Use vector similarity search
        }
      },
      take: 5
    });

    // Create relationship records
    for (const relatedMemory of similarMemories) {
      await this.createMemoryRelationship(memory, relatedMemory, 'derives');
    }

    return similarMemories;
  }

  private async createMemoryRelationship(
    source: MemoryEntry,
    target: MemoryEntry,
    relationType: 'updates' | 'extends' | 'derives'
  ): Promise<void> {
    // Update memoryRelations field
    const updatedRelations = {
      ...source.memoryRelations,
      [relationType]: [
        ...(source.memoryRelations[relationType] || []),
        target.id
      ]
    };

    await prisma.memoryEntry.update({
      where: { id: source.id },
      data: { memoryRelations: updatedRelations }
    });
  }
}
```

## Implementation Recommendations

### 1. Start with Basic Pipeline

```typescript
// Basic document processing flow
export async function processDocument(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId }
  });

  // 1. Extract content
  const extractor = new DocumentExtractor();
  const extractedContent = await extractor.extractContent(document);

  // 2. Update document
  await prisma.document.update({
    where: { id: documentId },
    data: {
      content: extractedContent.content,
      title: extractedContent.title,
      status: 'chunking'
    }
  });

  // 3. Create chunks
  const chunker = new DocumentChunker();
  const chunks = await chunker.createChunks(extractedContent.content, documentId);

  // 4. Generate embeddings
  const embeddingService = new EmbeddingService();
  await embeddingService.generateDocumentEmbeddings(chunks);

  // 5. Generate memories
  const memoryGenerator = new MemoryGenerator();
  const memories = await memoryGenerator.generateMemories(document, extractedContent.content);

  // 6. Establish relationships
  const relationshipService = new DocumentMemoryService();
  await relationshipService.establishRelationships(document, memories);

  // 7. Update status
  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'done' }
  });
}
```

### 2. Error Handling and Retry Logic

```typescript
class ProcessingErrorHandler {
  async handleDocumentError(documentId: string, error: Error): Promise<void> {
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    // Update processing metadata with error
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'failed',
        processingMetadata: {
          ...document.processingMetadata,
          error: error.message,
          failedAt: new Date()
        }
      }
    });

    // Schedule retry if appropriate
    if (this.isRetryableError(error)) {
      await this.scheduleRetry(documentId, error);
    }
  }
}
```

## Next Steps for Your Implementation

1. **Implement the memory generation service** using the patterns above
2. **Add background job processing** for embedding generation
3. **Create relationship scoring algorithms** for better memory-document linking
4. **Add memory versioning and evolution** tracking
5. **Implement cross-document memory linking** for better knowledge graph

The key insight is that this system creates a knowledge graph where documents and memories are nodes, connected by various relationship types, with embeddings enabling semantic search and similarity matching.

Would you like me to elaborate on any specific part of this implementation or help you implement any of these services in your backend?
