import type { Request, Response } from 'express';
import { streamText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import prisma from '../db/prismaClient';
import { z } from 'zod';
import { MemoryService } from '../services/chat.service';
import { convertToModelMessages } from 'ai';

const chatRequestSchema = z.object({
  messages: z.array(z.any()),
  metadata: z.object({
    projectId: z.string(),
    model: z.string().optional(),
  }),
});

const titleRequestSchema = z.object({
  prompt: z.string(),
});

const memoryService = new MemoryService();

// interface MemoryResult {
//   documentId?: string;
//   title?: string;
//   content?: string;
//   url?: string;
//   score?: number;
// }

// interface SearchMemoriesOutput {
//   count: number;
//   results: MemoryResult[];
// }

// interface AddMemoryOutput {
//   success: boolean;
//   memoryId?: string;
// }

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
//       model: google('gemini-2.5-pro'),
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
    // console.log("REQ BODY:", req.body);
    // console.log("REQ HEADERS:", req.headers);

    const { messages, metadata } = chatRequestSchema.parse(req.body);
    const { projectId } = metadata;

    // Verify the project/space exists
    const space = await prisma.space.findUnique({
      where: { id: projectId },
    });

    if (!space) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const tools = {
      search_memories: tool({
        name: 'search_memories',
        description:
          "Search user memories and patterns. Run when explicitly asked or when context about user's past choices would be helpful. Uses semantic matching to find relevant details across related experiences.",
        inputSchema: z.object({
          informationToGet: z
            .string()
            .describe("The information to search for in the user's memories."),
        }),
        execute: async ({ informationToGet }: { informationToGet: string }) => {
          console.log(`[Memory Search] Query: ${informationToGet}, Project: ${projectId}`);
          const response = await memoryService.searchMemories(informationToGet, projectId);

          // Process and format the memories
          if (!response.success || !response.results || response.results.length === 0) {
            return { memories: [], note: 'No relevant memories found.' };
          }
          // Take top 3 most relevant memories
          const topMemories = response.results.slice(0, 3).map((mem) => ({
            title: mem.title,
            content: mem.content,
            relevance: Math.round((mem.score || 0) * 100),
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
        },
      }),

      add_memory: tool({
        name: 'add_memory',
        description:
          "Add a new memory to the user's memories. Run when explicitly asked or when the user mentions any information generalizable beyond the context of the current conversation.",
        inputSchema: z.object({
          memory: z.string().describe('The memory to add.'),
        }),
        execute: async ({ memory }: { memory: string }) => {
          console.log(`[Memory Add] Memory: ${memory}, Project: ${projectId}`);
          return await memoryService.addMemory(memory, projectId);
        },
      }),

      fetch_memory: tool({
        name: 'fetch_memory',
        description: 'Fetch a specific memory by ID to get its full details.',
        inputSchema: z.object({
          memoryId: z.string().describe('The ID of the memory to fetch.'),
        }),
        execute: async ({ memoryId }: { memoryId: string }) => {
          console.log(`[Memory Fetch] ID: ${memoryId}, Project: ${projectId}`);
          return await memoryService.fetchMemory(memoryId, projectId);
        },
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
    const conversationMessages = [...messages];
    let continueLoop = true;
    let iterationCount = 0;
    const maxIterations = 5;

    while (continueLoop && iterationCount < maxIterations) {
      iterationCount++;
      console.log(`[Iteration ${iterationCount}] Starting generation`);

      const now = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'medium',
      });

      const result = await streamText({
        model: google('gemini-2.5-pro'),
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
        `,
      });

      // let assistantText = "";
      let hasToolCalls = false;

      // Stream the text and collect tool calls
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          const chunk = part.text;
          if (chunk && chunk.length > 0) {
            // assistantText += chunk;
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
            finalResponse.messages || (finalResponse as any).responseMessages || [];

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
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function chatRequestWithID(req: Request, res: Response) {
  try {
    // const { id } = req.params;
    const { messages, metadata } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const { projectId } = metadata || {};

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required in metadata' });
    }

    const memoryService = new MemoryService();

    // console.log(" messages:", JSON.stringify(messages, null, 2));

    const tools = {
      search_memories: tool({
        name: 'search_memories',
        description: 'Search user memories and patterns.',
        inputSchema: z.object({
          informationToGet: z.string().describe('The information to search for.'),
        }),
        execute: async ({ informationToGet }: { informationToGet: string }) => {
          console.log(`[Memory Search] Query: ${informationToGet}, Project: ${projectId}`);
          //TODO: we need to pass the users projectId here from the frontend later
          const response = await memoryService.searchMemories(informationToGet, projectId);

          if (!response.success || !response.results || response.results.length === 0) {
            return {
              count: 0,
              results: [],
              note: 'No relevant memories found.',
            };
          }

          // Dynamic memory count selection (min 2, max 10) based on score quality & distribution.
          // Heuristic rationale:
          // 1. Compute quality metric combining highest score, average of top 5, and overall average.
          // 2. Map this quality to a base count using thresholds.
          // 3. Adjust downward if there's an early steep drop (>45%) vs top score.
          // 4. Adjust upward if many scores are tightly clustered near the top (within 0.05).
          // This is intentionally conservative to avoid flooding the model with low‑value context.
          const maxCandidates = Math.min(10, response.results.length);
          const candidateResults = response.results.slice(0, maxCandidates);
          const scores = candidateResults.map((r) => (typeof r.score === 'number' ? r.score! : 0));

          const topScore = scores[0];
          const avgTop5 =
            scores.slice(0, Math.min(5, scores.length)).reduce((a, b) => a + b, 0) /
            Math.min(5, scores.length);
          const avgAll = scores.reduce((a, b) => a + b, 0) / scores.length;
          const quality = (topScore + avgTop5 + avgAll) / 3; // blended quality metric

          // Base count mapping by quality bands
          const qualityBands: { threshold: number; count: number }[] = [
            { threshold: 0.3, count: 2 },
            { threshold: 0.45, count: 3 },
            { threshold: 0.55, count: 4 },
            { threshold: 0.65, count: 5 },
            { threshold: 0.72, count: 6 },
            { threshold: 0.8, count: 7 },
            { threshold: 0.87, count: 8 },
            { threshold: 0.93, count: 9 },
            { threshold: 0.97, count: 10 },
          ];
          let baseCount = 2;
          for (const band of qualityBands) {
            if (quality >= band.threshold) baseCount = band.count;
            else break;
          }

          // Detect steep drop: first index after position 1 where score < 55% of top.
          const dropIndex = scores.findIndex((s, i) => i > 1 && s < topScore * 0.55);
          if (dropIndex !== -1) {
            baseCount = Math.min(baseCount, Math.max(2, dropIndex));
          }

          // Dense cluster near top (within 0.05 of topScore)
          const denseCluster = scores.filter((s) => topScore - s <= 0.05).length;
          if (denseCluster >= 4) {
            baseCount = Math.max(baseCount, denseCluster); // ensure we include dense similar high scores
          }

          // Final clamp & ensure we don't exceed available results
          const chosenCount = Math.min(Math.max(baseCount, 2), maxCandidates);

          const dynamicMemories = candidateResults.slice(0, chosenCount).map((mem) => ({
            documentId: mem.documentId,
            title: mem.title,
            content: mem.content,
            url: mem.url,
            score: mem.score,
          }));

          // console.log(
          //   `[Memory Search] Dynamic Selection => quality=${quality.toFixed(3)} topScore=${topScore.toFixed(3)} chosenCount=${chosenCount} scores=[${scores.map((s) => s.toFixed(2)).join(', ')}]`,
          // );

          return {
            count: dynamicMemories.length,
            results: dynamicMemories,
          };
        },
      }),

      add_memory: tool({
        name: 'add_memory',
        description: "Add a new memory to the user's memories.",
        inputSchema: z.object({
          memory: z.string().describe('The memory to add.'),
        }),
        execute: async ({ memory }: { memory: string }) => {
          //TODO: we need to pass the users projectId here from the frontend later
          console.log(`[Memory Add] Memory: ${memory}, Project: ${projectId}`);
          const result = await memoryService.addMemory(memory, projectId);

          return {
            success: result.success,
            memoryId: result.memory?.id,
            status: result.memory?.status,
          };
        },
      }),

      fetch_memory: tool({
        name: 'fetch_memory',
        description: 'Fetch a specific memory by ID.',
        inputSchema: z.object({
          memoryId: z.string().describe('The ID of the memory to fetch.'),
        }),
        execute: async ({ memoryId }: { memoryId: string }) => {
          console.log(`[Memory Fetch] ID: ${memoryId}, Project: ${projectId}`);
          return await memoryService.fetchMemory(memoryId, projectId);
        },
      }),
    };

    const now = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'medium',
    });
    // const modelMessages = convertUIToModelMessages(messages);
    // console.log("Converted messages:", JSON.stringify(modelMessages, null, 2));

    const convertToModel = convertToModelMessages(messages);
    // console.log(`converted msg: ${JSON.stringify(convertToModel)} `)

    const result = await streamText({
      model: google('gemini-2.5-flash'),
      messages: convertToModel,
      tools: tools,
      maxSteps: 5,
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
        4. If no memories are found (e.g., { memories: [], note: '...' }), just say "I couldn't remember anything about that ,if you want me to remember please tell me."
        `,
    });

    result.pipeUIMessageStreamToResponse(res);
  } catch (error) {
    console.log('Chat request error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request format',
        details: error.errors,
      });
    }

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
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
          content: `Generate a title for this conversation: ${prompt}`,
        },
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
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/* Helper functions */

// function convertMessages(frontendMessages: any[]) {
//   return frontendMessages
//     .map((message) => {
//       const baseMessage = {
//         role: message.role,
//         content: "",
//       };

//       // Handle different message types
//       switch (message.role) {
//         case "user":
//           if (message.parts && Array.isArray(message.parts)) {
//             const textContent = message.parts
//               .filter((part: any) => part.type === "text")
//               .map((part: any) => part.text)
//               .join("\n");
//             return { ...baseMessage, content: textContent };
//           }
//           return baseMessage;

//         case "assistant":
//           if (message.parts && Array.isArray(message.parts)) {
//             const textContent = message.parts
//               .filter((part: any) => part.type === "text")
//               .map((part: any) => part.text)
//               .join("\n");

//             const toolCalls = message.parts
//               .filter((part: any) => part.type === "tool-call")
//               .map((part: any) => ({
//                 toolCallId: part.toolCallId,
//                 toolName: part.toolName,
//                 args: part.args,
//               }));

//             if (toolCalls.length > 0) {
//               return {
//                 ...baseMessage,
//                 content: textContent,
//                 toolCalls,
//               };
//             }
//             return { ...baseMessage, content: textContent };
//           }
//           return baseMessage;

//         case "tool":
//           if (message.parts && Array.isArray(message.parts)) {
//             const textContent = message.parts
//               .filter((part: any) => part.type === "text")
//               .map((part: any) => part.text)
//               .join("\n");

//             return {
//               ...baseMessage,
//               content: textContent,
//               toolCallId: message.toolCallId,
//             };
//           }
//           return baseMessage;

//         default:
//           return baseMessage;
//       }
//     })
//     .filter(
//       (msg) => msg.content !== "" || (msg.toolCalls && msg.toolCalls.length > 0)
//     );
// }

// function convertUIToModelMessages(
//   uiMessages: any[]
// ): { role: string; content: string }[] {
//   return uiMessages.map((msg) => {
//     // Join all text parts into a single content string (ignore non-text parts if any)
//     const content = msg?.parts
//       ?.filter((part: any) => part.type === "text")
//       .map((part: any) => part.text)
//       .join(" ");

//     return {
//       role: msg.role,
//       content,
//     };
//   });
// }
