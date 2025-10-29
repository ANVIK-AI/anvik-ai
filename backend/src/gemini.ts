import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required')
}

if(!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY
}
export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)


export function embeddingModelName() {
  //TODO:test and try using this gemini-gemini-embedding-001 model as this is used by supermemory
  // Use 'text-embedding-004' (recommended). If you want to mirror sample output labels, use 'gemini-gemini-embedding-001'.
  return 'text-embedding-004'
}
