import type { Request, Response } from "express";
import { streamText, tool } from 'ai';
import { google } from '@ai-sdk/google';
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


// export async function chatRequest(req: Request, res: Response) {
//   try {
//     const { messages, metadata } = chatRequestSchema.parse(req.body);
//     const { projectId } = metadata;

//     // Verify the project/space exists
//     const space = await prisma.space.findUnique({
//       where: { id: projectId }
//     });

//     if (!space) {
//       return res.status(404).json({ error: 'Project not found' });
//     }

//     const tools = {
//       search_memories: tool({
//         name: 'search_memories',
//         description: 'Search user memories and patterns. Run when explicitly asked or when context about user\'s past choices would be helpful. Uses semantic matching to find relevant details across related experiences.',
//         inputSchema: z.object({
//           informationToGet: z.string().describe('The information to search for in the user\'s memories.')
//         }),
//         execute: async ({ informationToGet }: { informationToGet: string }) => {
//           console.log(`[Memory Search] Query: ${informationToGet}, Project: ${projectId}`);
//           const response = await memoryService.searchMemories(informationToGet, projectId);

//           // Process and format the memories
//           if (!response.success || !response.results || response.results.length === 0) {
//             return { memories: [], note: 'No relevant memories found.' };
//           }
//           // Take top 3 most relevant memories
//           const topMemories = response.results.slice(0, 3).map(mem => ({
//             title: mem.title,
//             content: mem.content,
//             relevance: Math.round((mem.score || 0) * 100)
//           }));

//           console.log(`[Memory Search] Top Memories: ${JSON.stringify(topMemories)}`);

//           return { memories: topMemories };
//         }
//       }),

//       add_memory: tool({
//         name: 'add_memory',
//         description: 'Add a new memory to the user\'s memories. Run when explicitly asked or when the user mentions any information generalizable beyond the context of the current conversation.',
//         inputSchema: z.object({
//           memory: z.string().describe('The memory to add.')
//         }),
//         execute: async ({ memory }: { memory: string }) => {
//           console.log(`[Memory Add] Memory: ${memory}, Project: ${projectId}`);
//           return await memoryService.addMemory(memory, projectId);
//         }
//       }),

//       fetch_memory: tool({
//         name: 'fetch_memory',
//         description: 'Fetch a specific memory by ID to get its full details.',
//         inputSchema: z.object({
//           memoryId: z.string().describe('The ID of the memory to fetch.')
//         }),
//         execute: async ({ memoryId }: { memoryId: string }) => {
//           console.log(`[Memory Fetch] ID: ${memoryId}, Project: ${projectId}`);
//           return await memoryService.fetchMemory(memoryId, projectId);
//         }
//       }),
//     };

//     const result = await streamText({
//       model: google('gemini-2.5-flash'),
//       messages,
//       tools: tools,
//       maxSteps: 5,
//       system: `You are a helpful assistant with access to the user's personal memories.

//       When answering questions:

//       For general knowledge questions, use your own knowledge directly
//       Use search/add memory tools when the question relates to the user's personal information, preferences, or past experiences
//       Always provide a helpful response even if no relevant memories are found
//       You must always say something when you call a tool to explain what you're doing.

//       [IMPORTANT] How to use 'search_memories' tool results:
//       1. After you get a JSON object from the 'search_memories' tool (e.g., { memories: [...] }), you MUST synthesize that information into a natural, conversational answer.
//       2. Do NOT just list the memories or output the raw JSON.
//       3. If the memories provide a clear answer (e.g., "I like to play football"), state it directly (e.g., "Based on your memories, it looks like your favorite sport is football.").
//       4. If no memories are found (e.g., { memories: [], note: '...' }), just say "I couldn't find any memories about that."
//       `
//     });

//     // Set headers for streaming response
//     res.setHeader('Content-Type', 'text/plain; charset=utf-8');
//     res.setHeader('Transfer-Encoding', 'chunked');
//     res.setHeader('Cache-Control', 'no-cache');
//     res.setHeader('Connection', 'keep-alive');
//     // Flush headers so browsers start rendering stream immediately
//     const resAny = res as any;
//     if (typeof resAny.flushHeaders === 'function') {
//       resAny.flushHeaders();
//     }
//     // Kickstart the stream to avoid buffering in some proxies/browsers
//     res.write('\n');

//     // Pipe the stream to the response and track if any content was sent
//     let anyTextSent = false;
//     let accumulated = '';

//     // Iterate over the full stream to handle text, tool calls, and final response
//     for await (const part of result.fullStream) {
//       switch (part.type) {
//         case 'text-delta': {
//           const chunk = part.text; 
//           if (chunk && chunk.length > 0) {
//             anyTextSent = true;
//             accumulated += chunk;
//             res.write(chunk);
//           }
//           break;
//         }

//         case 'tool-call': {
//           // Log when the tool call starts
//           console.log(
//             `[Tool Call] Calling ${part.toolName} with input:`,
//             part.input,
//           );
//           break;
//         }

//         case 'tool-result': {
//           // Log when the tool result is available
//           const resultStr = part.result ? JSON.stringify(part.result) : 'undefined';
//           console.log(`[Tool Result] ${part.toolName} finished with result:`, resultStr.substring(0, 200));
//           break;
//         }

//         case 'finish': {
//           // Log when the model finishes
//           console.log(`[Stream Finish] Reason: ${part.finishReason}`);
//           break;
//         }
//       }
//     }

//     // Fallback: if model produced no or too-short text, synthesize a brief answer from memory search
//     // const shouldUseFallback = !anyTextSent || (accumulated.trim().length < 40);
//     // console.log('[Fallback]', {
//     //   anyTextSent,
//     //   accumulatedLength: accumulated.trim().length,
//     //   shouldUseFallback,
//     //   firstChunk: accumulated.substring(0, 50) + (accumulated.length > 50 ? '...' : '')
//     // });

//     // if (shouldUseFallback) {
//     //   try {
//     //     const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user');
//     //     const query = typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : '';

//     //     console.log('[Memory Search] Query:', query);
//     //     const search = query ? await memoryService.searchMemories(query, projectId) : { success: false, count: 0, results: [] };
//     //     console.log('[Memory Search] Results:', {
//     //       success: search.success,
//     //       count: search.count,
//     //       results: search.results?.map(r => ({
//     //         id: r.documentId,
//     //         title: r.title,
//     //         score: r.score,
//     //         contentLength: r.content?.length
//     //       }))
//     //     });

//     //     const count = search.success ? search.count : 0;
//     //     const top = (search.results || []).slice(0, 3)
//     //       .map((r: any, i: number) => {
//     //         const title = r.title || 'Memory';
//     //         const score = typeof r.score === 'number' ? ` (relevance: ${(r.score * 100).toFixed(0)}%)` : '';
//     //         const content = r.content ? `\n  ${r.content.substring(0, 200)}${r.content.length > 200 ? '...' : ''}` : '';
//     //         return `- ${title}${score}${content}`;
//     //       })
//     //       .join('\n\n');
//     //     const prefix = anyTextSent ? '\n\n' : '';
//     //     const fallbackText = count > 0
//     //       ? `${prefix}I found ${count} relevant memory${count === 1 ? '' : 'ies'} in your knowledge base:\n\n${top}\n\nWould you like me to search for more details on any of these?`
//     //       : `${prefix}I couldn't find relevant memories for that yet. You can tell me something to remember, for example:\n- "Remember that I like playing chess and video games"\n- "I enjoy outdoor activities like hiking and cycling"`;
//     //     res.write(fallbackText);
//     //   } catch (e) {
//     //     // As a last resort, send a generic response
//     //     res.write('I checked your memories but could not generate a response.');
//     //   }
//     // }

//     res.end();
//   } catch (error) {
//     console.error('Chat error:', error);

//     // Check if headers have already been sent (streaming started)
//     if (res.headersSent) {
//       // If streaming has started, just end the response
//       console.error('Error occurred after streaming started - ending response');
//       if (!res.writableEnded) {
//         res.end();
//       }
//       return;
//     }

//     // Otherwise, send proper error response
//     if (error instanceof z.ZodError) {
//       return res.status(400).json({
//         error: 'Invalid request format',
//         details: error.errors
//       });
//     }

//     res.status(500).json({
//       error: 'Internal server error',
//       message: error instanceof Error ? error.message : 'Unknown error'
//     });
//   }
// }

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

    const tools = {
      search_memories: tool({
        name: 'search_memories',
        description: 'Search user memories and patterns. Run when explicitly asked or when context about user\'s past choices would be helpful. Uses semantic matching to find relevant details across related experiences.',
        inputSchema: z.object({
          informationToGet: z.string().describe('The information to search for in the user\'s memories.')
        }),
        execute: async ({ informationToGet }: { informationToGet: string }) => {
          console.log(`[Memory Search] Query: ${informationToGet}, Project: ${projectId}`);
          const response = await memoryService.searchMemories(informationToGet, projectId);

          // Process and format the memories
          if (!response.success || !response.results || response.results.length === 0) {
            return { memories: [], note: 'No relevant memories found.' };
          }
          // Take top 3 most relevant memories
          const topMemories = response.results.slice(0, 3).map(mem => ({
            title: mem.title,
            content: mem.content,
            relevance: Math.round((mem.score || 0) * 100)
          }));

          // console.log(`[Memory Search] Top Memories: ${JSON.stringify(topMemories)}`);
          console.log('[Memory Search] Top Memories:');
          topMemories.forEach((memory, index) => {
            console.log(`\n--- Memory ${index + 1} ---`);
            console.log(`Title: ${memory.title}`);
            console.log(`Content: ${memory.content}`);
            console.log(`Relevance: ${memory.relevance}%`);
          });

          return { memories: topMemories };
        }
      }),

      add_memory: tool({
        name: 'add_memory',
        description: 'Add a new memory to the user\'s memories. Run when explicitly asked or when the user mentions any information generalizable beyond the context of the current conversation.',
        inputSchema: z.object({
          memory: z.string().describe('The memory to add.')
        }),
        execute: async ({ memory }: { memory: string }) => {
          console.log(`[Memory Add] Memory: ${memory}, Project: ${projectId}`);
          return await memoryService.addMemory(memory, projectId);
        }
      }),

      fetch_memory: tool({
        name: 'fetch_memory',
        description: 'Fetch a specific memory by ID to get its full details.',
        inputSchema: z.object({
          memoryId: z.string().describe('The ID of the memory to fetch.')
        }),
        execute: async ({ memoryId }: { memoryId: string }) => {
          console.log(`[Memory Fetch] ID: ${memoryId}, Project: ${projectId}`);
          return await memoryService.fetchMemory(memoryId, projectId);
        }
      }),
    };

    // Set headers for streaming response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const resAny = res as any;
    if (typeof resAny.flushHeaders === 'function') {
      resAny.flushHeaders();
    }
    res.write('\n');

    // Manual multi-turn implementation for Gemini
    let conversationMessages = [...messages];
    let continueLoop = true;
    let iterationCount = 0;
    const maxIterations = 5;

    while (continueLoop && iterationCount < maxIterations) {
      iterationCount++;
      console.log(`[Iteration ${iterationCount}] Starting generation`);

      const now = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'medium'
      });

      const result = await streamText({
        model: google('gemini-2.5-flash'),
        messages: conversationMessages,
        tools: tools,
        system: `You are a helpful assistant with access to the user's personal memories.

        [Current Date & Time]: ${now}

        When answering questions:

        For general knowledge questions, use your own knowledge directly
        Use search/add memory tools when the question relates to the user's personal information, preferences, or past experiences
        Always provide a helpful response even if no relevant memories are found

        [IMPORTANT] How to use 'search_memories' tool results:
        1. After you get a JSON object from the 'search_memories' tool (e.g., { memories: [...] }), you MUST synthesize that information into a natural, conversational answer.
        2. Do NOT just list the memories or output the raw JSON.
        3. If the memories provide a clear answer (e.g., "I like to play football"), state it directly (e.g., "your favorite sport is football.").
        4. If no memories are found (e.g., { memories: [], note: '...' }), just say "I couldn't find any memories about that."
        `
      });

      let assistantText = '';
      let hasToolCalls = false;

      // Stream the text and collect tool calls
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          const chunk = part.text;
          if (chunk && chunk.length > 0) {
            assistantText += chunk;
            res.write(chunk);
          }
        } else if (part.type === 'tool-call') {
          hasToolCalls = true;
          console.log(`[Tool Call] ${part.toolName}`);
        } else if (part.type === 'tool-result') {
          console.log(`[Tool Result] ${part.toolName}`);
        } else if (part.type === 'finish') {
          console.log(`[Finish] Reason: ${part.finishReason}`);
        }
      }

      // After streaming completes, check if we need to continue
      if (hasToolCalls) {
        console.log(`[Iteration ${iterationCount}] Tool calls detected, getting response parts`);

        try {
          // Wait for the result to complete and get the raw response
          const finalResponse = await result.response;

          // Log what we got
          console.log(`[Response Keys]:`, Object.keys(finalResponse));
          console.log(`[Response Type]:`, typeof finalResponse);

          // Try different possible locations for the messages
          const responseMessages =
            finalResponse.messages ||
            (finalResponse as any).responseMessages ||
            [];

          console.log(`[Response Messages] Count: ${responseMessages.length}`);

          if (responseMessages.length > 0) {
            // Log first message structure
            console.log(`[First Message]:`, JSON.stringify(responseMessages[0]).substring(0, 200));
            conversationMessages.push(...responseMessages);
            continueLoop = true;
          } else {
            console.log('[Warning] No response messages found, trying to extract from result');
            // As a fallback, manually construct the continuation
            continueLoop = false;
          }
        } catch (err) {
          console.error('[Error] Getting response messages:', err);
          continueLoop = false;
        }
      } else {
        // No tool calls, we're done
        console.log(`[Iteration ${iterationCount}] No tool calls, ending`);
        continueLoop = false;
      }
    }

    if (iterationCount >= maxIterations) {
      console.log('[Warning] Max iterations reached');
    }

    res.end();
  } catch (error) {
    console.error('Chat error:', error);

    if (res.headersSent) {
      console.error('Error occurred after streaming started - ending response');
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

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