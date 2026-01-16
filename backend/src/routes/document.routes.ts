import { Router } from "express";
import { uploadDocumentFile, updateDocumentMetadata,getDocumentsWithMemories } from "../controller/document.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
const router = Router();

router.post("/documents/documents", isAuthenticated, getDocumentsWithMemories);
router.post("/v3/documents/file", isAuthenticated, uploadDocumentFile);
router.patch("/v3/documents/:id", isAuthenticated, updateDocumentMetadata);

export default router;