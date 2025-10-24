import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required')
}

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export function embeddingModelName() {
  // Use 'text-embedding-004' (recommended). If you want to mirror sample output labels, use 'gemini-gemini-embedding-001'.
  return 'text-embedding-004'
}
