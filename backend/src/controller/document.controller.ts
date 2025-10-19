import type { Request, Response } from "express";
import { DocumentsWithMemoriesQuerySchema } from "../validation/api";
import { getDocumentsWithMemories as getDocumentsService } from "../services/document.service";

export async function getDocumentsWithMemories(req: Request, res: Response) {
    console.log("📥 Received request to /documents/documents");
    console.log("Request body:", req.body);

    // 1. Validate the request body against the Zod schema
    const validationResult = DocumentsWithMemoriesQuerySchema.safeParse(req.body);

    if (!validationResult.success) {
        console.error("❌ Validation failed:", validationResult.error.format());
        return res.status(400).json({
            message: "Invalid request body",
            errors: validationResult.error.format(),
        });
    }

    try {
        console.log("✅ Request validated, calling service...");
        // 2. Pass the validated data to the service
        const data = await getDocumentsService(validationResult.data);
        console.log("✅ Service returned data:", {
            documentsCount: data.documents.length,
            pagination: data.pagination
        });

        // 3. Return the formatted response
        return res.status(200).json(data);
    } catch (error) {
        console.error("❌ Error in controller:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}