import type { Request, Response } from 'express';
import { streamText, tool } from 'ai';
import { getChatModel, getDefaultChatModel, getProChatModel } from '../providers/ai-provider';
import prisma from '../db/prismaClient';
import { z } from 'zod';
import { MemoryService } from '../services/chat.service';
import { convertToModelMessages } from 'ai';
import { getEmails, sendEmail, getEmailDetails } from '../agents/email.agent';
import {
  getCalendarEvents,
  setCalendarEvent,
  setBirthdayEvent,
  listCalendarTasks,
  setCalendarTask,
} from '../agents/calendar.agent';

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

export async function chatRequest(req: Request, res: Response) {
  try {
    console.log('Chat request Triggered \n\nREQ BODY:', req.body);
    // console.log("REQ HEADERS:", req.headers);

    const { messages, metadata } = chatRequestSchema.parse(req.body);
    const { projectId } = metadata;
    const userId = req.user.id;
    console.log(metadata);
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

      get_calendar_events: tool({
        name: 'getCalendarEvents',
        description: 'Get a list of Google Calendar events for a specific date range.',
        inputSchema: z.object({
          minTime: z.string().describe('The start date/time (ISO 8601 or YYYY-MM-DD).'),
          maxTime: z.string().describe('The end date/time (ISO 8601 or YYYY-MM-DD).'),
        }),
        execute: async (args) => {
          return await getCalendarEvents(args, userId);
        },
      }),

      set_calendar_event: tool({
        name: 'setCalendarEvent',
        description: 'Set a calendar event. All times must include a timezone.',
        inputSchema: z.object({
          summary: z.string().describe('The title or summary of the event.'),
          start: z.object({
            dateTime: z.string().describe("ISO 8601 format, e.g., '2025-11-20T09:00:00-07:00'"),
            timeZone: z.string().describe("The timezone, e.g., 'America/Los_Angeles'"),
          }),
          end: z.object({
            dateTime: z.string().describe('ISO 8601 format'),
            timeZone: z.string().describe('The timezone'),
          }),
          location: z.string().optional().describe('Location of the event'),
          description: z.string().optional().describe('Detailed description'),
          attendees: z.array(z.string().email()).optional().describe('List of attendee emails'),
          recurrence: z.array(z.string()).optional().describe('Recurrence rules like RRULE'),
        }),
        execute: async (args) => {
          return await setCalendarEvent(args, userId);
        },
      }),

      // --- ✅ Tasks Tools ---
      set_calendar_task: tool({
        name: 'setCalendarTask',
        description: 'Creates a new task in Google Tasks.',
        inputSchema: z.object({
          title: z.string().describe('The main title of the task.'),
          description: z.string().optional().describe('Additional notes.'),
          dueDate: z
            .string()
            .optional()
            .describe("ISO 8601 format (e.g., '2025-11-20T09:00:00Z')."),
          category: z
            .string()
            .optional()
            .describe("The task list name (e.g., 'Work', 'My Tasks')."),
          isCompleted: z.boolean().optional().describe('Set to true if task is already done.'),
        }),
        execute: async (args) => {
          return await setCalendarTask(args, userId);
        },
      }),

      list_calendar_tasks: tool({
        name: 'listCalendarTasks',
        description: 'List and filter tasks from Google Tasks.',
        inputSchema: z.object({
          category: z
            .string()
            .optional()
            .describe("The specific task list to view (e.g., 'Work')."),
          groupBy: z
            .enum(['category', 'status', 'none'])
            .optional()
            .describe('How to organize results.'),
          showCompleted: z.boolean().optional().default(true),
          dueMin: z.string().optional().describe('Filter tasks due AFTER this date.'),
          dueMax: z.string().optional().describe('Filter tasks due BEFORE this date.'),
        }),
        execute: async (args) => {
          return await listCalendarTasks(args, userId);
        },
      }),

      // --- 📧 Email Tools ---
      get_emails: tool({
        name: 'getEmails',
        description: 'List emails with metadata (Subject, Sender, Date). Optimized for lists.',
        inputSchema: z.object({
          filter: z
            .string()
            .optional()
            .describe("Specific Gmail search query like 'from:boss@gmail.com'."),
          category: z
            .enum(['INBOX', 'SENT', 'DRAFT', 'STARRED', 'ARCHIVED', 'SPAM', 'ALL'])
            .optional()
            .describe('Folder to search in.'),
          limit: z.number().optional().describe('Max number of emails to return.'),
        }),
        execute: async (args) => {
          return await getEmails(args, userId);
        },
      }),

      get_email_details: tool({
        name: 'getEmailDetails',
        description: 'Get the full body content of a specific email using its ID.',
        inputSchema: z.object({
          messageId: z.string().describe('The unique ID of the email to fetch.'),
        }),
        execute: async (args) => {
          return await getEmailDetails(args, userId);
        },
      }),

      send_email: tool({
        name: 'sendEmail',
        description: 'Send a new email to a recipient.',
        inputSchema: z.object({
          to: z.string().email().describe("Recipient's email address."),
          subject: z.string().describe('Email subject line.'),
          body: z.string().describe('Content of the email (HTML or Text).'),
        }),
        execute: async (args) => {
          return await sendEmail(args, userId);
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

      let result;
      try {
        result = await streamText({
          model: metadata.model ? getChatModel(metadata.model) : getProChatModel(),
          messages: conversationMessages,
          tools: tools,
          system: ` You are a helpful AI assistant with access to the user's personal memories and their Google Workspace (Calendar, Tasks, Gmail).

[Current Date & Time]: ${new Date().toISOString()}
[userId]: ${userId}

**CORE RESPONSIBILITIES:**

1. **Personal Memories:** Use 'search_memories' / 'add_memory' when the question relates to the user's preferences, past choices, or specific stored facts.
2. **Google Workspace:** Use the provided tools to manage the user's Calendar, Tasks, and Emails.

**TOOL USAGE GUIDELINES:**

* **Calendar & Tasks:**
    * When creating events or tasks, infer the current year/date from [Current Date & Time] if not specified.
    * If a user asks to "List my tasks", check if they specified a category (e.g., "Work"). If not, check all lists or ask for clarification if needed.
* **Email:**
    * When fetching emails, use the \`limit\` parameter to keep responses concise unless the user asks for many.
    * **Privacy:** Do not read out full email bodies unless explicitly asked. Summarize the 'snippet' or 'subject' first.

**RESPONSE FORMATTING (CRITICAL):**

* **Synthesize, Don't Dump:** Never output raw JSON or tool return values directly.
    * *Bad:* "Function returned { status: 'success', title: 'Meeting' }"
    * *Good:* "I've successfully scheduled the 'Meeting' for you."
* **Memories:** If \`search_memories\` returns data, weave it into your answer naturally (e.g., "Based on your memory of liking football..."). If empty, state you couldn't find that specific info.
* **Errors:** If a tool fails (e.g., "Permission denied"), explain it clearly to the user and suggest re-linking their account if necessary.
`,
        });
      } catch (streamError) {
        console.error(`[Iteration ${iterationCount}] Error calling streamText:`, streamError);
        const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown error';
        const isNetworkError =
          errorMessage.includes('ENOTFOUND') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('Cannot connect to API');

        // Write error message to stream if headers are sent
        if (res.headersSent) {
          res.write(
            `\n\n[Error] Unable to connect to AI service. Please check your internet connection and try again.`,
          );
          res.end();
          return;
        } else {
          return res.status(500).json({
            error: 'AI service error',
            message: isNetworkError
              ? 'Unable to connect to AI service. Please check your internet connection and try again.'
              : errorMessage,
          });
        }
      }

      // let assistantText = "";
      let hasToolCalls = false;

      // Stream the text and collect tool calls
      try {
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
      } catch (streamLoopError) {
        console.error(
          `[Iteration ${iterationCount}] Error during streaming loop:`,
          streamLoopError,
        );
        const errorMessage =
          streamLoopError instanceof Error ? streamLoopError.message : 'Unknown error';
        const isNetworkError =
          errorMessage.includes('ENOTFOUND') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('Cannot connect to API');
        if (!res.writableEnded) {
          res.write(
            `\n\n[Error] ${isNetworkError ? 'Unable to connect to AI service. Please check your internet connection and try again.' : errorMessage}`,
          );
          res.end();
        }
        continueLoop = false;
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
    // console.log("chat Req qith id triggered!!\n");
    // console.log(metadata);
    // console.log(req.user)
    const userId = req.user.id;
    // console.log(userId);

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
      get_calendar_events: tool({
        name: 'getCalendarEvents',
        description: 'Get a list of Google Calendar events for a specific date range.',
        inputSchema: z.object({
          minTime: z.string().describe('The start date/time (ISO 8601 or YYYY-MM-DD).'),
          maxTime: z.string().describe('The end date/time (ISO 8601 or YYYY-MM-DD).'),
        }),
        execute: async (args) => {
          return await getCalendarEvents(args, userId);
        },
      }),

      set_calendar_event: tool({
        name: 'setCalendarEvent',
        description: 'Set a calendar event. All times must include a timezone.',
        inputSchema: z.object({
          summary: z.string().describe('The title or summary of the event.'),
          start: z.object({
            dateTime: z.string().describe("ISO 8601 format, e.g., '2025-11-20T09:00:00-07:00'"),
            timeZone: z.string().describe("The timezone, e.g., 'America/Los_Angeles'"),
          }),
          end: z.object({
            dateTime: z.string().describe('ISO 8601 format'),
            timeZone: z.string().describe('The timezone'),
          }),
          location: z.string().optional().describe('Location of the event'),
          description: z.string().optional().describe('Detailed description'),
          attendees: z.array(z.string().email()).optional().describe('List of attendee emails'),
          recurrence: z.array(z.string()).optional().describe('Recurrence rules like RRULE'),
        }),
        execute: async (args) => {
          return await setCalendarEvent(args, userId);
        },
      }),

      // --- ✅ Tasks Tools ---
      set_calendar_task: tool({
        name: 'setCalendarTask',
        description: 'Creates a new task in Google Tasks.',
        inputSchema: z.object({
          title: z.string().describe('The main title of the task.'),
          description: z.string().optional().describe('Additional notes.'),
          dueDate: z
            .string()
            .optional()
            .describe("ISO 8601 format (e.g., '2025-11-20T09:00:00Z')."),
          category: z
            .string()
            .optional()
            .describe("The task list name (e.g., 'Work', 'My Tasks')."),
          isCompleted: z.boolean().optional().describe('Set to true if task is already done.'),
        }),
        execute: async (args) => {
          return await setCalendarTask(args, userId);
        },
      }),

      list_calendar_tasks: tool({
        name: 'listCalendarTasks',
        description: 'List and filter tasks from Google Tasks.',
        inputSchema: z.object({
          category: z
            .string()
            .optional()
            .describe("The specific task list to view (e.g., 'Work')."),
          groupBy: z
            .enum(['category', 'status', 'none'])
            .optional()
            .describe('How to organize results.'),
          showCompleted: z.boolean().optional().default(true),
          dueMin: z.string().optional().describe('Filter tasks due AFTER this date.'),
          dueMax: z.string().optional().describe('Filter tasks due BEFORE this date.'),
        }),
        execute: async (args) => {
          return await listCalendarTasks(args, userId);
        },
      }),

      // --- 📧 Email Tools ---
      get_emails: tool({
        name: 'getEmails',
        description: 'List emails with metadata (Subject, Sender, Date). Optimized for lists.',
        inputSchema: z.object({
          filter: z
            .string()
            .optional()
            .describe("Specific Gmail search query like 'from:boss@gmail.com'."),
          category: z
            .enum(['INBOX', 'SENT', 'DRAFT', 'STARRED', 'ARCHIVED', 'SPAM', 'ALL'])
            .optional()
            .describe('Folder to search in.'),
          limit: z.number().optional().describe('Max number of emails to return.'),
        }),
        execute: async (args) => {
          return await getEmails(args, userId);
        },
      }),

      get_email_details: tool({
        name: 'getEmailDetails',
        description: 'Get the full body content of a specific email using its ID.',
        inputSchema: z.object({
          messageId: z.string().describe('The unique ID of the email to fetch.'),
        }),
        execute: async (args) => {
          return await getEmailDetails(args, userId);
        },
      }),

      send_email: tool({
        name: 'sendEmail',
        description: 'Send a new email to a recipient.',
        inputSchema: z.object({
          to: z.string().email().describe("Recipient's email address."),
          subject: z.string().describe('Email subject line.'),
          body: z.string().describe('Content of the email (HTML or Text).'),
        }),
        execute: async (args) => {
          return await sendEmail(args, userId);
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

    const convertToModel = await convertToModelMessages(messages);
    // console.log(`converted msg: ${JSON.stringify(convertToModel)} `)

    let result;
    try {
      result = await streamText({
        model: metadata.model ? getChatModel(metadata.model) : getDefaultChatModel(),
        messages: convertToModel,
        tools: tools,
        maxSteps: 5,
        system: ` You are a helpful AI assistant with access to the user's personal memories and their Google Workspace (Calendar, Tasks, Gmail).

[Current Date & Time]: ${new Date().toISOString()}
[userId]: ${userId}

**CORE RESPONSIBILITIES:**

1. **Personal Memories:** Use 'search_memories' / 'add_memory' when the question relates to the user's preferences, past choices, or specific stored facts.
2. **Google Workspace:** Use the provided tools to manage the user's Calendar, Tasks, and Emails.

**TOOL USAGE GUIDELINES:**

* **Calendar & Tasks:**
    * When creating events or tasks, infer the current year/date from [Current Date & Time] if not specified.
    * If a user asks to "List my tasks", check if they specified a category (e.g., "Work"). If not, check all lists or ask for clarification if needed.
* **Email:**
    * When fetching emails, use the \`limit\` parameter to keep responses concise unless the user asks for many.
    * **Privacy:** Do not read out full email bodies unless explicitly asked. Summarize the 'snippet' or 'subject' first.

**RESPONSE FORMATTING (CRITICAL):**

* **Synthesize, Don't Dump:** Never output raw JSON or tool return values directly.
    * *Bad:* "Function returned { status: 'success', title: 'Meeting' }"
    * *Good:* "I've successfully scheduled the 'Meeting' for you."
* **Memories:** If \`search_memories\` returns data, weave it into your answer naturally (e.g., "Based on your memory of liking football..."). If empty, state you couldn't find that specific info.
* **Errors:** If a tool fails (e.g., "Permission denied"), explain it clearly to the user and suggest re-linking their account if necessary.
`,
      });
    } catch (streamError) {
      console.error('Error calling streamText:', streamError);
      const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown error';
      const isNetworkError =
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('Cannot connect to API');

      if (!res.headersSent) {
        return res.status(500).json({
          error: 'AI service error',
          message: isNetworkError
            ? 'Unable to connect to AI service. Please check your internet connection and try again.'
            : errorMessage,
        });
      } else {
        // Headers already sent, try to send error in stream format
        res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
        res.end();
        return;
      }
    }

    try {
      result.pipeUIMessageStreamToResponse(res);
    } catch (pipeError) {
      console.error('Error during streaming:', pipeError);
      if (!res.writableEnded) {
        if (!res.headersSent) {
          const errorMessage = pipeError instanceof Error ? pipeError.message : 'Unknown error';
          return res.status(500).json({
            error: 'Streaming error',
            message: errorMessage,
          });
        } else {
          // Headers sent, end the response
          res.end();
        }
      }
    }
  } catch (error) {
    console.error('Chat request error:', error);

    if (error instanceof z.ZodError) {
      if (!res.headersSent) {
        return res.status(400).json({
          error: 'Invalid request format',
          details: error.errors,
        });
      }
      return;
    }

    if (!res.headersSent) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isNetworkError =
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('Cannot connect to API');

      return res.status(500).json({
        error: 'Internal server error',
        message: isNetworkError
          ? 'Unable to connect to AI service. Please check your internet connection and try again.'
          : errorMessage,
      });
    } else {
      // Headers already sent, try to end gracefully
      if (!res.writableEnded) {
        res.end();
      }
    }
  }
}

export async function chatTitleRequest(req: Request, res: Response) {
  try {
    const { prompt } = titleRequestSchema.parse(req.body);

    console.log(`[Title Generation] Generating title for: "${prompt.substring(0, 100)}..."`);

    const result = streamText({
      model: getDefaultChatModel(),
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
