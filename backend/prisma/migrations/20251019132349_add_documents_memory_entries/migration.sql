-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "customId" TEXT,
    "contentHash" TEXT,
    "orgId" TEXT,
    "userId" TEXT,
    "connectionId" TEXT,
    "title" TEXT,
    "content" TEXT,
    "summary" TEXT,
    "url" TEXT,
    "source" TEXT,
    "type" TEXT,
    "status" TEXT,
    "metadata" JSONB,
    "processingMetadata" JSONB,
    "raw" TEXT,
    "tokenCount" INTEGER,
    "wordCount" INTEGER,
    "chunkCount" INTEGER,
    "averageChunkSize" DECIMAL(65,30),
    "summaryEmbedding" TEXT,
    "summaryEmbeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_entries" (
    "id" TEXT NOT NULL,
    "customId" TEXT,
    "connectionId" TEXT,
    "content" TEXT,
    "metadata" JSONB,
    "source" TEXT,
    "status" TEXT,
    "summary" TEXT,
    "title" TEXT,
    "type" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "containerTags" TEXT[],
    "chunkCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "memory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_memory_sources" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "memoryEntryId" TEXT NOT NULL,
    "sourceAddedAt" TIMESTAMP(3),
    "sourceRelevanceScore" DECIMAL(65,30),
    "sourceMetadata" JSONB,
    "spaceContainerTag" TEXT,

    CONSTRAINT "document_memory_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "document_memory_sources_documentId_memoryEntryId_key" ON "document_memory_sources"("documentId", "memoryEntryId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_memory_sources" ADD CONSTRAINT "document_memory_sources_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_memory_sources" ADD CONSTRAINT "document_memory_sources_memoryEntryId_fkey" FOREIGN KEY ("memoryEntryId") REFERENCES "memory_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
