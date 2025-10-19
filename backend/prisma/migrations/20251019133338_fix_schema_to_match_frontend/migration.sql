/*
  Warnings:

  - You are about to drop the column `contentHash` on the `documents` table. All the data in the column will be lost.
  - The `raw` column on the `documents` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `chunkCount` on the `memory_entries` table. All the data in the column will be lost.
  - You are about to drop the column `connectionId` on the `memory_entries` table. All the data in the column will be lost.
  - You are about to drop the column `containerTags` on the `memory_entries` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `memory_entries` table. All the data in the column will be lost.
  - You are about to drop the column `customId` on the `memory_entries` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `memory_entries` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `memory_entries` table. All the data in the column will be lost.
  - You are about to drop the column `summary` on the `memory_entries` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `memory_entries` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `memory_entries` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `memory_entries` table. All the data in the column will be lost.
  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `document_memory_sources` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `orgId` on table `documents` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `documents` required. This step will fail if there are existing NULL values in that column.
  - Made the column `type` on table `documents` required. This step will fail if there are existing NULL values in that column.
  - Made the column `status` on table `documents` required. This step will fail if there are existing NULL values in that column.
  - Made the column `chunkCount` on table `documents` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `memory` to the `memory_entries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orgId` to the `memory_entries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `spaceId` to the `memory_entries` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."document_memory_sources" DROP CONSTRAINT "document_memory_sources_documentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."document_memory_sources" DROP CONSTRAINT "document_memory_sources_memoryEntryId_fkey";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "contentHash",
ADD COLUMN     "ogImage" TEXT,
ADD COLUMN     "summaryEmbeddingModelNew" TEXT,
ADD COLUMN     "summaryEmbeddingNew" TEXT,
ALTER COLUMN "orgId" SET NOT NULL,
ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "type" SET NOT NULL,
ALTER COLUMN "type" SET DEFAULT 'text',
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'unknown',
DROP COLUMN "raw",
ADD COLUMN     "raw" BYTEA,
ALTER COLUMN "chunkCount" SET NOT NULL,
ALTER COLUMN "chunkCount" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "memory_entries" DROP COLUMN "chunkCount",
DROP COLUMN "connectionId",
DROP COLUMN "containerTags",
DROP COLUMN "content",
DROP COLUMN "customId",
DROP COLUMN "source",
DROP COLUMN "status",
DROP COLUMN "summary",
DROP COLUMN "title",
DROP COLUMN "type",
DROP COLUMN "url",
ADD COLUMN     "forgetAfter" TIMESTAMP(3),
ADD COLUMN     "forgetReason" TEXT,
ADD COLUMN     "isForgotten" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isInference" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isLatest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "memory" TEXT NOT NULL,
ADD COLUMN     "memoryEmbedding" TEXT,
ADD COLUMN     "memoryEmbeddingModel" TEXT,
ADD COLUMN     "memoryEmbeddingNew" TEXT,
ADD COLUMN     "memoryEmbeddingNewModel" TEXT,
ADD COLUMN     "memoryRelations" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "orgId" TEXT NOT NULL,
ADD COLUMN     "parentMemoryId" TEXT,
ADD COLUMN     "rootMemoryId" TEXT,
ADD COLUMN     "sourceCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "spaceId" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- DropTable
DROP TABLE "public"."RefreshToken";

-- DropTable
DROP TABLE "public"."User";

-- DropTable
DROP TABLE "public"."document_memory_sources";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_settings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shouldLLMFilter" BOOLEAN NOT NULL DEFAULT false,
    "filterPrompt" TEXT,
    "includeItems" TEXT[],
    "excludeItems" TEXT[],
    "googleDriveCustomKeyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "googleDriveClientId" TEXT,
    "googleDriveClientSecret" TEXT,
    "notionCustomKeyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notionClientId" TEXT,
    "notionClientSecret" TEXT,
    "onedriveCustomKeyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "onedriveClientId" TEXT,
    "onedriveClientSecret" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "documentLimit" INTEGER NOT NULL DEFAULT 10000,
    "containerTags" TEXT[],
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spaces" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "orgId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "containerTag" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "isExperimental" BOOLEAN NOT NULL DEFAULT false,
    "contentTextIndex" JSONB NOT NULL DEFAULT '{}',
    "indexSize" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spaces_to_members" (
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spaces_to_members_pkey" PRIMARY KEY ("spaceId","userId")
);

-- CreateTable
CREATE TABLE "chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embeddedContent" TEXT,
    "type" TEXT NOT NULL DEFAULT 'text',
    "position" INTEGER NOT NULL,
    "metadata" JSONB,
    "embedding" TEXT,
    "embeddingModel" TEXT,
    "embeddingNew" TEXT,
    "embeddingNewModel" TEXT,
    "matryokshaEmbedding" TEXT,
    "matryokshaEmbeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents_to_spaces" (
    "documentId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,

    CONSTRAINT "documents_to_spaces_pkey" PRIMARY KEY ("documentId","spaceId")
);

-- CreateTable
CREATE TABLE "memory_document_sources" (
    "memoryEntryId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "relevanceScore" INTEGER NOT NULL DEFAULT 100,
    "metadata" JSONB,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_document_sources_pkey" PRIMARY KEY ("memoryEntryId","documentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organization_settings_orgId_key" ON "organization_settings"("orgId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaces_to_members" ADD CONSTRAINT "spaces_to_members_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_to_spaces" ADD CONSTRAINT "documents_to_spaces_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_to_spaces" ADD CONSTRAINT "documents_to_spaces_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_document_sources" ADD CONSTRAINT "memory_document_sources_memoryEntryId_fkey" FOREIGN KEY ("memoryEntryId") REFERENCES "memory_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_document_sources" ADD CONSTRAINT "memory_document_sources_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
