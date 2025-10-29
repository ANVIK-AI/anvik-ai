import { Router } from "express";
import { uploadDocumentFile, updateDocumentMetadata,getDocumentsWithMemories } from "../controller/document.controller";

const router = Router();

router.post("/documents/documents", getDocumentsWithMemories);
router.post("/v3/documents/file", uploadDocumentFile);
router.patch("/v3/documents/:id", updateDocumentMetadata);

export default router;