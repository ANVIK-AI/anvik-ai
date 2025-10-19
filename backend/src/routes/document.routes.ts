import { Router } from "express";
import { getDocumentsWithMemories } from "../controller/document.controller";

const router = Router();

// This maps to '@post/documents/documents'
// POST /documents/documents
router.post("/documents/documents", getDocumentsWithMemories);

export default router;