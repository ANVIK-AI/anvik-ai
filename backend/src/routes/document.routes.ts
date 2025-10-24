import { Router } from "express";
import { getDocumentsWithMemories } from "../controller/document.controller";
import { uploadDocumentFile, updateDocumentMetadata } from "../controller/document.controller";

const router = Router();

// This maps to '@post/documents/documents'
// POST /documents/documents
router.post("/documents/documents", getDocumentsWithMemories);

// File upload route
// POST /v3/documents/file
router.post("/v3/documents/file", uploadDocumentFile);

// Update document metadata
// PATCH /v3/documents/:id
router.patch("/v3/documents/:id", updateDocumentMetadata);

export default router;