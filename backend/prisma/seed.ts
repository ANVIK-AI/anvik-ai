import { PrismaClient } from '../generated/prisma';

// Initialize Prisma Client
const prisma = new PrismaClient();

// The main function where all the seeding logic happens
async function main() {
  console.log('🌱 Starting the seeding process...');

  // 1. --- CLEAN UP EXISTING DATA ---
  // This makes the seeder re-runnable without creating duplicates.
  console.log('🧹 Clearing previous data...');
  await prisma.memoryDocumentSource.deleteMany({});
  await prisma.memoryEntry.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.space.deleteMany({});

  // 2. --- CREATE SPACES ---
  console.log('🏠 Creating sample spaces...');
  const [space1, space2] = await Promise.all([
    prisma.space.create({
      data: {
        id: 'space_proj_alpha',
        name: 'Project Alpha',
        containerTag: 'sm_project_alpha',
        orgId: 'org_123',
        ownerId: 'user_abc',
        visibility: 'private',
      },
    }),
    prisma.space.create({
      data: {
        id: 'space_perf_report',
        name: 'Performance Reports',
        containerTag: 'sm_performance_review',
        orgId: 'org_123',
        ownerId: 'user_abc',
        visibility: 'private',
      },
    }),
  ]);
  console.log(`✅ Created 2 spaces.`);

  // 3. --- CREATE DOCUMENTS ---
  console.log('📄 Creating sample documents...');
  const [doc1, doc2] = await Promise.all([
    prisma.document.create({
      data: {
        id: 'doc_seed_01',
        title: 'Project Alpha Onboarding Guide',
        content:
          'Welcome to Project Alpha. This document outlines the project goals, timeline, and key stakeholders for the first quarter of 2025.',
        orgId: 'org_123',
        userId: 'user_abc',
        source: 'Google Drive',
        type: 'google_doc',
        status: 'done',
        chunkCount: 12,
        wordCount: 1500,
        createdAt: new Date('2025-10-15T10:00:00Z'),
      },
    }),
    prisma.document.create({
      data: {
        id: 'doc_seed_02',
        title: 'Frontend Performance Analysis Q3 2025',
        summary:
          'This report covers the performance metrics of our web application, focusing on load times and user engagement.',
        orgId: 'org_123',
        userId: 'user_abc',
        source: 'Internal Wiki',
        type: 'webpage',
        status: 'done',
        chunkCount: 8,
        wordCount: 950,
        createdAt: new Date('2025-10-18T14:30:00Z'),
      },
    }),
    prisma.document.create({
      data: {
        id: 'doc_seed_03',
        title: 'User Feedback on New Feature',
        content: 'A collection of tweets and support tickets regarding the new dashboard feature.',
        orgId: 'org_123',
        userId: 'user_xyz', // A different user
        source: 'Twitter',
        type: 'tweet',
        status: 'processing',
        chunkCount: 5,
        wordCount: 400,
        createdAt: new Date('2025-10-12T09:00:00Z'),
      },
    }),
  ]);
  console.log(`✅ Created 3 documents.`);

  // 4. --- CREATE MEMORY ENTRIES ---
  console.log('🧠 Creating sample memory entries...');
  const [mem1, mem2, mem3] = await Promise.all([
    prisma.memoryEntry.create({
      data: {
        id: 'mem_seed_01',
        memory: "Project Alpha's main goal is to refactor the authentication service.",
        spaceId: space1.id,
        orgId: 'org_123',
        userId: 'user_abc',
      },
    }),
    prisma.memoryEntry.create({
      data: {
        id: 'mem_seed_02',
        memory: 'The deadline for the first phase of Project Alpha is November 20th, 2025.',
        spaceId: space1.id,
        orgId: 'org_123',
        userId: 'user_abc',
      },
    }),
    prisma.memoryEntry.create({
      data: {
        id: 'mem_seed_03',
        memory:
          "Users have reported that the web app's initial load time can exceed 3 seconds on slow connections.",
        spaceId: space2.id,
        orgId: 'org_123',
        userId: 'user_abc',
      },
    }),
  ]);
  console.log(`✅ Created 3 memory entries.`);

  // 5. --- LINK DOCUMENTS AND MEMORIES ---
  // This is the most important part for testing your route.
  console.log('🔗 Linking documents to memories...');
  await prisma.memoryDocumentSource.createMany({
    data: [
      // Link Document 1 to Memory 1 & 2 (belongs to 'sm_project_alpha')
      {
        documentId: doc1.id,
        memoryEntryId: mem1.id,
        relevanceScore: 95,
      },
      {
        documentId: doc1.id,
        memoryEntryId: mem2.id,
        relevanceScore: 88,
      },
      // Link Document 2 to Memory 3 (belongs to 'sm_performance_review')
      {
        documentId: doc2.id,
        memoryEntryId: mem3.id,
        relevanceScore: 92,
      },
    ],
  });
  console.log(`✅ Created 3 links between documents and memories.`);
}

// Execute the main function and handle success or errors
main()
  .catch((e) => {
    console.error('❌ An error occurred during seeding:', e);
    throw e; // Re-throw to exit with error code
  })
  .finally(async () => {
    console.log('🌱 Seeding finished. Disconnecting Prisma Client...');
    await prisma.$disconnect();
  });
