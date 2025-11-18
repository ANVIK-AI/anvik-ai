import type { Request, Response } from 'express';
import { DocumentsWithMemoriesQuerySchema } from '../validation/api';
import { getDocumentsWithMemories as getDocumentsService } from '../services/document.service';
import {
  uploadDocumentFile as uploadDocumentService,
  updateDocumentMetadata as updateDocumentService,
} from '../services/document.service';
// import multer from "multer";
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

export async function getDocumentsWithMemories(req: Request, res: Response) {
  // console.log("📥 Received request to /documents/documents");
  // console.log("Request body:", req.body);

  // 1. Validate the request body against the Zod schema
  const validationResult = DocumentsWithMemoriesQuerySchema.safeParse(req.body);

  if (!validationResult.success) {
    console.error('❌ Validation failed:', validationResult.error.format());
    return res.status(400).json({
      message: 'Invalid request body',
      errors: validationResult.error.format(),
    });
  }

  try {
    // console.log("✅ Request validated, calling service...");
    // 2. Pass the validated data to the service
    const data = await getDocumentsService(validationResult.data);
    // console.log("✅ Service returned data:", {
    //     documentsCount: data.documents.length,
    //     pagination: data.pagination
    // });

    // 3. Return the formatted response
    return res.status(200).json(data);
  } catch (error) {
    console.error('❌ Error in controller:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// Very simple auth placeholders
function getAuth(req: Request) {
  // You likely have a session cookie. For now, just use demo IDs.
  const orgId = (req as any).orgId || 'demo_org';
  const userId = (req as any).userId || 'demo_user';
  return { orgId, userId };
}

const ContainerTagsSchema = z.string().transform((s) => {
  try {
    return JSON.parse(s) as string[];
  } catch {
    throw new Error('containerTags must be JSON array string');
  }
});

// Local file storage for demo purposes. Replace with S3/GCS in prod.
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// const upload = multer({
//   dest: uploadsDir,
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10MB limit
//   },
//   fileFilter: (req, file, cb) => {
//     // Allow common file types
//     const allowedTypes = [
//       'application/pdf',
//       'text/plain',
//       'text/markdown',
//       'text/csv',
//       'application/json',
//       'application/msword',
//       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//       'image/jpeg',
//       'image/png',
//       'image/gif',
//       'image/webp'
//     ]

//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true)
//     } else {
//       cb(new Error('File type not allowed'))
//     }
//   }
// })

export async function uploadDocumentFile(req: Request, res: Response) {
  try {
    const { orgId, userId } = getAuth(req);
    const { file } = req as any;

    if (!file) {
      return res.status(400).json({ error: 'file is required' });
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }

    let containerTags: string[];
    try {
      containerTags = req.body.containerTags
        ? ContainerTagsSchema.parse(req.body.containerTags)
        : ['sm_project_default'];
    } catch (error) {
      console.error('ContainerTags validation error:', error);
      return res.status(400).json({ error: 'Invalid containerTags format' });
    }

    logger.info('calling service file upload');
    console.log('calling service file upload');
    // Call the service to handle the upload
    const result = await uploadDocumentService({
      file,
      containerTags,
      orgId,
      userId,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

export async function updateDocumentMetadata(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { metadata } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    const result = await updateDocumentService(id, metadata);
    return res.json(result);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Update failed' });
  }
}
