import { tool } from 'ai';
import { z } from 'zod';

/**
 * Base interface for AI tools
 * All tools should implement this interface
 */
export interface BaseToolConfig {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
}

/**
 * Tool execution context
 * Provides access to project and metadata for tool execution
 */
export interface ToolContext {
  projectId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Base class for creating AI tools
 * Extend this class to create custom tools
 */
export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: z.ZodObject<any>;

  /**
   * Execute the tool with given input and context
   */
  abstract execute(input: any, context: ToolContext): Promise<any>;

  /**
   * Create an AI SDK tool instance from this tool definition
   */
  toAISDKTool() {
    return tool({
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      execute: async (input: any) => {
        // Extract context from input if provided, otherwise use defaults
        const context: ToolContext = {
          projectId: input._context?.projectId || 'default',
          userId: input._context?.userId,
          metadata: input._context?.metadata || {},
        };

        // Remove context from input before passing to execute
        const { _context, ...toolInput } = input;

        return this.execute(toolInput, context);
      },
    });
  }
}


