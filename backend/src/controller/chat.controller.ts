import type { Request, Response } from 'express';
import { streamText, tool } from 'ai';
import { getChatModel, getDefaultChatModel, getProChatModel } from '../providers/ai-provider.js';
import { google } from '@ai-sdk/google';
import prisma from '../db/prismaClient.js';
import { z } from 'zod';
import { MemoryService } from '../services/chat.service.js';
import { convertToModelMessages } from 'ai';
import { getEmails, sendEmail, getEmailDetails } from '../agents/email.agent.js';
import {
  getCalendarEvents,
  setCalendarEvent,
  setBirthdayEvent,
  listCalendarTasks,
  setCalendarTask,
} from '../agents/calendar.agent.js';

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

    // Define tools with consistent naming
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

          if (!response.success || !response.results || response.results.length === 0) {
            return { count: 0, results: [], note: 'No relevant memories found.' };
          }

          // Dynamic memory selection based on quality
          const maxCandidates = Math.min(10, response.results.length);
          const candidateResults = response.results.slice(0, maxCandidates);
          const scores = candidateResults.map((r) => (typeof r.score === 'number' ? r.score : 0));

          const topScore = scores[0];
          const avgTop5 =
            scores.slice(0, Math.min(5, scores.length)).reduce((a, b) => a + b, 0) /
            Math.min(5, scores.length);
          const avgAll = scores.reduce((a, b) => a + b, 0) / scores.length;
          const quality = (topScore + avgTop5 + avgAll) / 3;

          const qualityBands = [
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

          const dropIndex = scores.findIndex((s, i) => i > 1 && s < topScore * 0.55);
          if (dropIndex !== -1) {
            baseCount = Math.min(baseCount, Math.max(2, dropIndex));
          }

          const denseCluster = scores.filter((s) => topScore - s <= 0.05).length;
          if (denseCluster >= 4) {
            baseCount = Math.max(baseCount, denseCluster);
          }

          const chosenCount = Math.min(Math.max(baseCount, 2), maxCandidates);
          const dynamicMemories = candidateResults.slice(0, chosenCount).map((mem) => ({
            documentId: mem.documentId,
            title: mem.title,
            content: mem.content,
            url: mem.url,
            score: mem.score,
          }));

          console.log('[Memory Search] Top Memories:');
          dynamicMemories.forEach((memory, index) => {
            console.log(`\n--- Memory ${index + 1} ---`);
            console.log(`Title: ${memory.title}`);
            console.log(`Score: ${memory.score}`);
          });

          return { count: dynamicMemories.length, results: dynamicMemories };
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
        description: 'Fetch a specific memory by ID to get its full details.',
        inputSchema: z.object({
          memoryId: z.string().describe('The ID of the memory to fetch.'),
        }),
        execute: async ({ memoryId }: { memoryId: string }) => {
          console.log(`[Memory Fetch] ID: ${memoryId}, Project: ${projectId}`);
          return await memoryService.fetchMemory(memoryId, projectId);
        },
      }),

      search_contact: tool({
        name: 'search_contact',
        description:
          "Search for a person's contact information (email, phone) in the user's memories. Use this to find email addresses before sending emails. Returns email addresses and any other contact details stored about a person.",
        inputSchema: z.object({
          personName: z
            .string()
            .describe(
              "The name of the person to find contact information for (e.g., 'Ayush Patil', 'John').",
            ),
        }),
        execute: async ({ personName }: { personName: string }) => {
          console.log(`[Contact Search] Looking for: ${personName}, Project: ${projectId}`);
          // Search memories for contact information
          const searchQuery = `${personName} email contact phone number`;
          const response = await memoryService.searchMemories(searchQuery, projectId);

          if (!response.success || !response.results || response.results.length === 0) {
            return {
              found: false,
              person: personName,
              email: null,
              phone: null,
              note: `No contact information found for "${personName}" in memories.`,
            };
          }

          // Extract email patterns from results
          const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
          const phonePattern = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;

          let foundEmails: string[] = [];
          let foundPhones: string[] = [];
          let relevantMemories: any[] = [];

          for (const result of response.results.slice(0, 5)) {
            const content = result.content || '';
            const title = result.title || '';
            const combined = `${title} ${content}`;

            const emails = combined.match(emailPattern);
            const phones = combined.match(phonePattern);

            if (emails) foundEmails.push(...emails);
            if (phones) foundPhones.push(...phones);

            // Check if this memory mentions the person's name
            if (combined.toLowerCase().includes(personName.toLowerCase())) {
              relevantMemories.push({
                title: result.title,
                content: result.content,
                score: result.score,
              });
            }
          }

          // Deduplicate
          foundEmails = [...new Set(foundEmails)];
          foundPhones = [...new Set(foundPhones)];

          return {
            found: foundEmails.length > 0 || foundPhones.length > 0,
            person: personName,
            email: foundEmails.length > 0 ? foundEmails[0] : null,
            allEmails: foundEmails,
            phone: foundPhones.length > 0 ? foundPhones[0] : null,
            allPhones: foundPhones,
            memories: relevantMemories.slice(0, 3),
            note:
              foundEmails.length > 0
                ? `Found ${foundEmails.length} email(s) for ${personName}.`
                : `No email found for "${personName}". You may need to ask the user for the email address.`,
          };
        },
      }),

      get_calendar_events: tool({
        name: 'get_calendar_events',
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
        name: 'set_calendar_event',
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

      set_calendar_task: tool({
        name: 'set_calendar_task',
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
        name: 'list_calendar_tasks',
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

      get_emails: tool({
        name: 'get_emails',
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
        name: 'get_email_details',
        description: 'Get the full body content of a specific email using its ID.',
        inputSchema: z.object({
          messageId: z.string().describe('The unique ID of the email to fetch.'),
        }),
        execute: async (args) => {
          return await getEmailDetails(args, userId);
        },
      }),

      send_email: tool({
        name: 'send_email',
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

    const systemPrompt = `You are a helpful AI assistant with access to the user's personal memories and their Google Workspace (Calendar, Tasks, Gmail).

[Current Date & Time]: ${new Date().toISOString()}
[userId]: ${userId}

**CORE RESPONSIBILITIES:**

1. **Personal Memories:** Use 'search_memories' / 'add_memory' when the question relates to the user's preferences, past choices, or specific stored facts.
2. **Google Workspace:** Use the provided tools to manage the user's Calendar, Tasks, and Emails.

**TOOL USAGE GUIDELINES:**

* **Multi-Step Operations:** You can use multiple tools in sequence to accomplish complex tasks. For example, first search memories, then create a calendar event based on what you found.
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
`;

    // Convert messages to model format
    const convertedMessages = await convertToModelMessages(messages);

    let result;
    try {
      // Use streamText with maxSteps for automatic multi-step tool calling
      result = await streamText({
        model: metadata.model ? getChatModel(metadata.model) : getProChatModel(),
        messages: convertedMessages,
        tools: tools,
        maxSteps: 10, // Allow up to 10 sequential tool calls
        system: systemPrompt,
        onStepFinish: ({ stepType, toolCalls, toolResults }) => {
          if (stepType === 'tool-result') {
            console.log(`[Step Complete] Tool calls: ${toolCalls?.length || 0}`);
            toolCalls?.forEach((tc) => {
              console.log(`  - ${tc.toolName}: ${JSON.stringify(tc.args).substring(0, 100)}...`);
            });
          }
        },
      });
    } catch (streamError) {
      console.error('Error calling streamText:', streamError);
      const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown error';
      const isNetworkError =
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('Cannot connect to API');

      return res.status(500).json({
        error: 'AI service error',
        message: isNetworkError
          ? 'Unable to connect to AI service. Please check your internet connection and try again.'
          : errorMessage,
      });
    }

    // Use pipeUIMessageStreamToResponse for proper streaming with tool call events
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
          res.end();
        }
      }
    }
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

      search_contact: tool({
        name: 'search_contact',
        description:
          "Search for a person's contact information (email, phone) in the user's memories. Use this to find email addresses before sending emails. Returns email addresses and any other contact details stored about a person.",
        inputSchema: z.object({
          personName: z
            .string()
            .describe(
              "The name of the person to find contact information for (e.g., 'Ayush Patil', 'John').",
            ),
        }),
        execute: async ({ personName }: { personName: string }) => {
          console.log(`[Contact Search] Looking for: ${personName}, Project: ${projectId}`);
          const searchQuery = `${personName} email contact phone number`;
          const response = await memoryService.searchMemories(searchQuery, projectId);

          if (!response.success || !response.results || response.results.length === 0) {
            return {
              found: false,
              person: personName,
              email: null,
              phone: null,
              note: `No contact information found for "${personName}" in memories.`,
            };
          }

          const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
          const phonePattern = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;

          let foundEmails: string[] = [];
          let foundPhones: string[] = [];
          let relevantMemories: any[] = [];

          for (const result of response.results.slice(0, 5)) {
            const content = result.content || '';
            const title = result.title || '';
            const combined = `${title} ${content}`;

            const emails = combined.match(emailPattern);
            const phones = combined.match(phonePattern);

            if (emails) foundEmails.push(...emails);
            if (phones) foundPhones.push(...phones);

            if (combined.toLowerCase().includes(personName.toLowerCase())) {
              relevantMemories.push({
                title: result.title,
                content: result.content,
                score: result.score,
              });
            }
          }

          foundEmails = [...new Set(foundEmails)];
          foundPhones = [...new Set(foundPhones)];

          return {
            found: foundEmails.length > 0 || foundPhones.length > 0,
            person: personName,
            email: foundEmails.length > 0 ? foundEmails[0] : null,
            allEmails: foundEmails,
            phone: foundPhones.length > 0 ? foundPhones[0] : null,
            allPhones: foundPhones,
            memories: relevantMemories.slice(0, 3),
            note:
              foundEmails.length > 0
                ? `Found ${foundEmails.length} email(s) for ${personName}.`
                : `No email found for "${personName}". You may need to ask the user for the email address.`,
          };
        },
      }),

      get_calendar_events: tool({
        name: 'get_calendar_events',
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
        name: 'set_calendar_event',
        description:
          "Schedule a calendar event. If the user doesn't specify a year/date, INFER it from the current date. For 'tomorrow' or 'next friday', calculate the actual ISO date.",
        inputSchema: z.object({
          summary: z.string().describe('The title or summary of the event.'),
          start: z.object({
            dateTime: z.string().describe("ISO 8601 format (e.g. '2025-11-20T09:00:00-07:00')."),
            timeZone: z.string().describe("The timezone (e.g. 'America/Los_Angeles')."),
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

      set_calendar_task: tool({
        name: 'set_calendar_task',
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
        name: 'list_calendar_tasks',
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

      get_emails: tool({
        name: 'get_emails',
        description:
          'List emails to find information or specific messages. USE THIS TO FIND CONTACTS OR EMAIL ADDRESSES by searching for their name (e.g. filter: "Ayush").',
        inputSchema: z.object({
          filter: z
            .string()
            .optional()
            .describe(
              "Gmail search query. To find a person's email, search for their name here (e.g. 'Ayush'). OR use standard queries like 'from:boss@gmail.com'.",
            ),
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
        name: 'get_email_details',
        description: 'Get the full body content of a specific email using its ID.',
        inputSchema: z.object({
          messageId: z.string().describe('The unique ID of the email to fetch.'),
        }),
        execute: async (args) => {
          return await getEmailDetails(args, userId);
        },
      }),

      send_email: tool({
        name: 'send_email',
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

    const convertToModel = await convertToModelMessages(messages);

    const systemPrompt = `You are a helpful AI assistant with access to the user's personal memories and their Google Workspace (Calendar, Tasks, Gmail).

[Current Date & Time]: ${new Date().toISOString()}
[userId]: ${userId}

**CORE RESPONSIBILITIES:**

1. **Personal Memories:** Use 'search_memories' / 'add_memory' when the question relates to the user's preferences, past choices, or specific stored facts.
2. **Google Workspace:** Use the provided tools to manage the user's Calendar, Tasks, and Emails.

**TOOL USAGE GUIDELINES:**

* **Multi-Step Operations:** You can use multiple tools in sequence to accomplish complex tasks. For example, first search memories, then create a calendar event based on what you found.
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
`;

    let result;
    try {
      result = await streamText({
        model: metadata.model ? getChatModel(metadata.model) : getDefaultChatModel(),
        messages: convertToModel,
        tools: tools,
        maxSteps: 10,
        system: systemPrompt,
        onStepFinish: ({ stepType, toolCalls, toolResults }) => {
          if (stepType === 'tool-result') {
            console.log(`[Step Complete] Tool calls: ${toolCalls?.length || 0}`);
            toolCalls?.forEach((tc) => {
              console.log(`  - ${tc.toolName}: ${JSON.stringify(tc.args).substring(0, 100)}...`);
            });
          }
        },
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
