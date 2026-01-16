-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "memory_entries" ADD COLUMN     "embedding" vector(768);
