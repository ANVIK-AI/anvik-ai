import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Load environment variables
import 'dotenv/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),

  // Datasource URL for Prisma CLI commands (migrations, introspection, etc.)
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
