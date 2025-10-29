import type { Request, Response } from "express";
import { streamText, dynamicTool, generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';
import { randomUUID } from 'crypto';
import prisma from "../db/prismaClient";


import { z } from "zod";
import { MemoryService } from "../services/chat.service";

const chatRequestSchema = z.object({
  messages: z.array(z.any()),
  metadata: z.object({
    projectId: z.string(),
    model: z.string().optional()
  })
});

const titleRequestSchema = z.object({
  prompt: z.string()
});

const memoryService = new MemoryService();


export async function chatRequest(req: Request, res: Response) {
  try {
    const { messages, metadata } = chatRequestSchema.parse(req.body);
    const { projectId } = metadata;

    // Verify the project/space exists
    const space = await prisma.space.findUnique({
      where: { id: projectId }
    });

    if (!space) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Define explicit types for each tool
    type SearchMemoriesTool = {
      description: string;
      parameters: z.ZodObject<{
        informationToGet: z.ZodString;
      }>;
      execute: (args: { informationToGet: string }) => Promise<any>;
    };

    type AddMemoryTool = {
      description: string;
      parameters: z.ZodObject<{
        memory: z.ZodString;
      }>;
      execute: (args: { memory: string }) => Promise<any>;
    };

    type FetchMemoryTool = {
      description: string;
      parameters: z.ZodObject<{
        memoryId: z.ZodString;
      }>;
      execute: (args: { memoryId: string }) => Promise<any>;
    };

    type Tools = {
      searchMemories: SearchMemoriesTool;
      addMemory: AddMemoryTool;
      fetchMemory: FetchMemoryTool;
    };

    const tools: Tools = {
      searchMemories: {
        description: 'Search user memories and patterns. Run when explicitly asked or when context about user\'s past choices would be helpful. Uses semantic matching to find relevant details across related experiences.',
        parameters: z.object({
          informationToGet: z.string().describe('The information to search for in the user\'s memories.')
        }),
        execute: async ({ informationToGet }: { informationToGet: string }) => {
          console.log(`[Memory Search] Query: ${informationToGet}, Project: ${projectId}`);
          const response = await memoryService.searchMemories(informationToGet, projectId);
          
          // Process and format the memories
          if (!response.success || !response.results || response.results.length === 0) {
            return 'No relevant memories found.';
          }
          
          // Take top 3 most relevant memories
          const topMemories = response.results.slice(0, 3);
          
          // Format the memories for the model to use
          const formattedMemories = topMemories.map((memory, index) => 
            `Memory ${index + 1} (relevance: ${Math.round((memory.score || 0) * 100)}%):\n` +
            `${memory.title ? `Title: ${memory.title}\n` : ''}` +
            `${memory.content || ''}`
          ).join('\n\n');
          
          return `Here's what I found in your memories:\n\n${formattedMemories}\n\n` +
          `[IMPORTANT: Use these memories to directly answer the user's question in a natural way. ` +
          `Don't just list the memories - synthesize the information into a helpful response. ` +
          `If the memories don't fully answer the question, say so and ask for clarification.]`;
        }
      },

      addMemory: {
        description: 'Add a new memory to the user\'s memories. Run when explicitly asked or when the user mentions any information generalizable beyond the context of the current conversation.',
        parameters: z.object({
          memory: z.string().describe('The memory to add.')
        }),
        execute: async ({ memory }: { memory: string }) => {
          console.log(`[Memory Add] Memory: ${memory}, Project: ${projectId}`);
          return await memoryService.addMemory(memory, projectId);
        }
      },

      fetchMemory: {
        description: 'Fetch a specific memory by ID to get its full details.',
        parameters: z.object({
          memoryId: z.string().describe('The ID of the memory to fetch.')
        }),
        execute: async ({ memoryId }: { memoryId: string }) => {
          console.log(`[Memory Fetch] ID: ${memoryId}, Project: ${projectId}`);
          return await memoryService.fetchMemory(memoryId, projectId);
        }
      }
    };
    
    // Create a new object with proper typing for the stream configuration
    const streamConfig = {
      model: google('gemini-2.5-flash'),
      messages,
      toolChoice: 'required',  // Force the model to use tools when appropriate
      tools: Object.values(tools),  // Convert to array of tools
      system: `You are a helpful assistant with access to the user's personal memories.

IMPORTANT INSTRUCTIONS:
1. When the user asks about personal information, preferences, or past experiences, you MUST use the searchMemories tool.
2. When you receive memory results, ALWAYS use them to directly answer the user's question in a natural, conversational way.
3. Don't just list the memories - synthesize the information and provide a helpful response.
4. If the memories don't fully answer the question, say so and ask for clarification.
5. Always maintain a helpful and natural conversation flow.

TOOLS:
- searchMemories: Use when you need to find information from the user's past experiences or memories.
- addMemory: Use to save important information the user wants to remember.
- fetchMemory: Use to retrieve a specific memory by its ID.

EXAMPLES:
User: "What's my name?"
Assistant: "Let me check your personal information." [uses searchMemories]

User: "Remember that I like coffee"
Assistant: "I'll make a note that you like coffee." [uses addMemory]

User: "What was that thing you told me yesterday?"
Assistant: "Let me look that up in your memories." [uses searchMemories]`
    };
    
    // Use type assertion to bypass complex type checking
    const result = await streamText({
      ...streamConfig,
      maxTokens: 1000,
      temperature: 0.7,
    } as any);

    // Set headers for streaming response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Flush headers so browsers start rendering stream immediately
    const resAny = res as any;
    if (typeof resAny.flushHeaders === 'function') {
      resAny.flushHeaders();
    }
    // Kickstart the stream to avoid buffering in some proxies/browsers
    res.write('\n');

    // Pipe the stream to the response and track if any content was sent
    let anyTextSent = false;
    let accumulated = '';
    for await (const chunk of result.textStream) {
      if (chunk && chunk.length > 0) {
        anyTextSent = true;
        accumulated += chunk;
        res.write(chunk);
      }
    }

    // Fallback: if model produced no or too-short text, synthesize a brief answer from memory search
    const shouldUseFallback = !anyTextSent || (accumulated.trim().length < 40);
    console.log('[Fallback]', {
      anyTextSent,
      accumulatedLength: accumulated.trim().length,
      shouldUseFallback,
      firstChunk: accumulated.substring(0, 50) + (accumulated.length > 50 ? '...' : '')
    });

    if (shouldUseFallback) {
      try {
        const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user');
        const query = typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : '';

        console.log('[Memory Search] Query:', query);
        const search = query ? await memoryService.searchMemories(query, projectId) : { success: false, count: 0, results: [] };
        console.log('[Memory Search] Results:', {
          success: search.success,
          count: search.count,
          results: search.results?.map(r => ({
            id: r.documentId,
            title: r.title,
            score: r.score,
            contentLength: r.content?.length
          }))
        });

        const count = search.success ? search.count : 0;
        const top = (search.results || []).slice(0, 3)
          .map((r: any, i: number) => {
            const title = r.title || 'Memory';
            const score = typeof r.score === 'number' ? ` (relevance: ${(r.score * 100).toFixed(0)}%)` : '';
            const content = r.content ? `\n  ${r.content.substring(0, 200)}${r.content.length > 200 ? '...' : ''}` : '';
            return `- ${title}${score}${content}`;
          })
          .join('\n\n');
        const prefix = anyTextSent ? '\n\n' : '';
        const fallbackText = count > 0
          ? `${prefix}I found ${count} relevant memory${count === 1 ? '' : 'ies'} in your knowledge base:\n\n${top}\n\nWould you like me to search for more details on any of these?`
          : `${prefix}I couldn't find relevant memories for that yet. You can tell me something to remember, for example:\n- "Remember that I like playing chess and video games"\n- "I enjoy outdoor activities like hiking and cycling"`;
        res.write(fallbackText);
      } catch (e) {
        // As a last resort, send a generic response
        res.write('I checked your memories but could not generate a response.');
      }
    }

    res.end();
  } catch (error) {
    console.error('Chat error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request format',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


export async function chatTitleRequest(req: Request, res: Response) {
  try {
    const { prompt } = titleRequestSchema.parse(req.body);

    console.log(`[Title Generation] Generating title for: "${prompt.substring(0, 100)}..."`);

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: `Generate a very short title (2-5 words) that summarizes the following conversation starter. 
        Return only the title, no other text. Make it concise and descriptive.`,
      messages: [
        {
          role: 'user',
          content: `Generate a title for this conversation: ${prompt}`
        }
      ],
      maxOutputTokens: 20,
    });

    // Set headers for streaming response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    // Stream the title
    for await (const chunk of result.textStream) {
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    console.error('Title generation error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request format',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}