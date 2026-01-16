import prisma from '../db/prismaClient.js';
import {
  DocumentsWithMemoriesQuerySchema,
  DocumentWithMemoriesSchema,
  MemoryEntryAPISchema,
} from '../validation/api.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { boss, JOB_PROCESS_DOCUMENT } from '../queue.js';

// --- Type Definitions for Clarity ---

// Type for the validated input from the controller
type QueryInput = z.infer<typeof DocumentsWithMemoriesQuerySchema>;

// Type for the final shape of a single document in the response
type FormattedDocument = z.infer<typeof DocumentWithMemoriesSchema>;

// Type for the final shape of a single memory entry in the response
type FormattedMemoryEntry = z.infer<typeof MemoryEntryAPISchema>;

/**
 * A robust helper function to parse vector strings from the database.
 * Prisma returns vector data as a string like "[0.1, 0.2, ...]".
 * This function safely parses it into a number array.
 * @param vectorString The vector string from the database.
 * @returns An array of numbers, or null if the input is invalid or empty.
 */
function parseVectorString(vectorString: string | null | undefined): number[] | null {
  if (!vectorString) {
    return null;
  }
  try {
    const parsed = JSON.parse(vectorString);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'number')) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.error('Failed to parse vector string:', vectorString, error);
    return null; // Return null on parsing error to avoid crashes
  }
}

/**
 * Fetches documents and their associated memory entries with filtering and pagination.
 * This service handles all database interaction and data transformation.
 *
 * @param input The validated query parameters.
 * @returns An object containing the list of documents and pagination metadata.
 */
export async function getDocumentsWithMemories(input: QueryInput) {
  // 1. Destructure the validated query input for use in the Prisma query.
  const { page, limit, sort, order, containerTags } = input;

  // 2. Prepare pagination and sorting parameters for Prisma.
  const skip = (page - 1) * limit;
  const orderBy = { [sort]: order } as any;

  // 3. Dynamically construct the 'where' clause for filtering.
  // This ensures the 'containerTags' filter is only applied if it's provided.
  const whereClause: any = {};
  if (containerTags && containerTags.length > 0) {
    whereClause.memorySources = {
      some: {
        memoryEntry: {
          space: {
            containerTag: {
              in: containerTags,
            },
          },
        },
      },
    };
  }

  // 4. Execute queries in a transaction for efficiency and data consistency.
  // This fetches the total count and the paginated data in a single database round-trip.
  const [totalItems, documentsFromDb] = await prisma.$transaction([
    prisma.document.count({ where: whereClause }),
    prisma.document.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy,
      include: {
        // We fetch the join table records...
        memorySources: {
          where:
            containerTags && containerTags.length > 0
              ? {
                  memoryEntry: {
                    space: {
                      containerTag: {
                        in: containerTags,
                      },
                    },
                  },
                }
              : {},
          include: {
            // ...and for each join record, we include the full memory entry.
            // This nested include is the key to getting all related data.
            memoryEntry: {
              include: {
                space: true, // Include space to get containerTag
              },
            },
          },
        },
      },
    }),
  ]);

  // 5. Transform the raw database data into the precise API response shape.
  // This is the most critical step to ensure the output matches the Zod schema.
  const formattedDocuments: FormattedDocument[] = documentsFromDb.map((doc) => {
    const { memorySources, ...documentData } = doc;

    // Map over the join table entries to format each memory entry
    const memoryEntries: FormattedMemoryEntry[] = memorySources.map((source) => {
      const { memoryEntry, ...sourceData } = source;

      // This object combines the memory entry data with the join table data
      // to perfectly match the `MemoryEntryAPISchema`.
      return {
        ...memoryEntry,
        // --- Data Type Conversions ---
        memoryEmbedding: parseVectorString(memoryEntry.memoryEmbedding),
        memoryEmbeddingNew: parseVectorString(memoryEntry.memoryEmbeddingNew),
        sourceRelevanceScore: sourceData.relevanceScore ? Number(sourceData.relevanceScore) : null,
        // --- Join Table Fields ---
        sourceAddedAt: sourceData.addedAt,
        sourceMetadata: sourceData.metadata as any,
        spaceContainerTag: memoryEntry.space?.containerTag || null,
        // --- Type Conversions ---
        memoryRelations: (memoryEntry.memoryRelations as any) || {},
        metadata: memoryEntry.metadata as any,
      };
    });

    // This final object combines the document data with its formatted memories
    // to perfectly match the `DocumentWithMemoriesSchema`.
    return {
      ...documentData,
      // --- Data Type Conversions ---
      summaryEmbedding: parseVectorString(documentData.summaryEmbedding),
      averageChunkSize: documentData.averageChunkSize
        ? Number(documentData.averageChunkSize)
        : null,
      // --- Formatted Relationship Array ---
      memoryEntries,
      // --- Type Conversions ---
      type: documentData.type as any,
      status: documentData.status as any,
      metadata: documentData.metadata as any,
      processingMetadata: documentData.processingMetadata as any,
    };
  });

  // 6. Calculate total pages and construct the final pagination object.
  const totalPages = Math.ceil(totalItems / limit);
  const pagination = {
    currentPage: page,
    limit,
    totalItems,
    totalPages,
  };

  // 7. Return the final, schema-compliant response object.
  return {
    documents: formattedDocuments,
    pagination,
  };
}

function inferTypeFromMime(mime: string) {
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'text'; // doc/docx => text after conversion
  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('csv')) return 'text';
  if (mime.includes('json')) return 'text';
  if (mime.includes('markdown') || mime.includes('text')) return 'text';
  return 'text';
}

export async function uploadDocumentFile({
  file,
  containerTags,
  orgId,
  userId,
}: {
  file: any;
  containerTags: string[];
  orgId: string;
  userId: string;
}) {
  // Ensure spaces exist for each containerTag
  const spaceIds: string[] = [];
  for (const tag of containerTags) {
    // First try to find existing space
    let space = await prisma.space.findFirst({
      where: { containerTag: tag },
    });

    if (!space) {
      // Create new space if it doesn't exist
      space = await prisma.space.create({
        data: {
          id: uuidv4(),
          orgId,
          ownerId: userId,
          containerTag: tag,
          visibility: 'private',
          isExperimental: false,
        },
      });
    } else {
      console.log('space id already present: ', space);
    }
    spaceIds.push(space.id);
  }

  // Insert document stub with status queued
  const id = uuidv4();
  const type = inferTypeFromMime(file.mimetype);
  const metadata = {
    sm_internal_fileName: file.originalname,
    sm_internal_fileSize: file.size,
    sm_internal_fileType: file.mimetype,
  };

  // AI-generated title will be set by the worker after content extraction
  await prisma.document.create({
    data: {
      id,
      orgId,
      userId,
      title: file.originalname,
      type,
      status: 'queued',
      metadata,
      processingMetadata: { startTime: Date.now(), steps: [] },
    },
  });

  // Link document to spaces
  // console.log('space ids: ', spaceIds);
  // console.log('document id: ', id);
  for (const spaceId of spaceIds) {
    await prisma.documentsToSpaces.create({
      data: {
        documentId: id,
        spaceId,
      },
    });
  }

  // Store raw file bytes (optional). For large files prefer object storage.
  //TODO: update storing of files to cloudinary
  const raw = fs.readFileSync(file.path);
  await prisma.document.update({
    where: { id },
    data: { raw },
  });

  // Clean up temporary file
  try {
    fs.unlinkSync(file.path);
  } catch (error) {
    console.warn('Failed to delete temporary file:', error);
  }

  console.log('heyyy');
  // Enqueue processing job
  await boss
    .send(JOB_PROCESS_DOCUMENT, {
      documentId: id,
      containerTags,
      mimetype: file.mimetype,
    })
    .catch((e) => {
      console.log(e);
    });

  // Respond immediately
  return { id, status: 'queued' };
}

export async function updateDocumentMetadata(id: string, metadata: any) {
  const existingDoc = await prisma.document.findUnique({ where: { id } });
  if (!existingDoc) {
    throw new Error('Document not found');
  }

  const document = await prisma.document.update({
    where: { id },
    data: {
      metadata: {
        ...((existingDoc.metadata as any) || {}),
        ...metadata,
      },
      updatedAt: new Date(),
    },
  });

  return { id: document.id, status: document.status };
}
