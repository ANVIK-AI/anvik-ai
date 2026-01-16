import { google } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';

export type ProviderType = 'gemini' | 'groq';

// Initialize Groq client (lazy - only when API key is available)
const getGroqClient = () => {
  if (!process.env.GROQ_API_KEY) {
    return null;
  }
  return createGroq({
    apiKey: process.env.GROQ_API_KEY,
  });
};

// Default models for each provider
const PROVIDER_MODELS = {
  gemini: {
    default: 'gemini-2.5-flash',
    pro: 'gemini-2.5-pro',
  },
  groq: {
    default: 'qwen/qwen3-32b',
  },
} as const;

/**
 * Detect provider from model name
 * Groq-hosted models include: qwen, llama, mixtral, gemma, deepseek, etc.
 */
export function detectProvider(modelName?: string): ProviderType {
  if (!modelName) return 'gemini';

  const lowerModel = modelName.toLowerCase();

  // Groq model patterns (models hosted on Groq)
  const groqPatterns = [
    'qwen',
    'llama',
    'mixtral',
    'gemma',
    'deepseek',
    'whisper',
    'distil-whisper',
  ];

  if (groqPatterns.some((pattern) => lowerModel.includes(pattern))) {
    return 'groq';
  }

  // Default to Gemini for gemini-* models or unknown models
  return 'gemini';
}

/**
 * Get the appropriate chat model based on model name
 * Automatically detects provider from model name
 *
 * @param modelName - The model identifier (e.g., 'gemini-2.5-flash', 'qwen/qwen3-32b')
 * @returns The configured model instance for use with Vercel AI SDK
 *
 * @example
 * // Use default Gemini model
 * const model = getChatModel();
 *
 * @example
 * // Use specific Qwen model via Groq
 * const model = getChatModel('qwen/qwen3-32b');
 *
 * @example
 * // Use specific Gemini model
 * const model = getChatModel('gemini-2.5-pro');
 */
export function getChatModel(modelName?: string) {
  const provider = detectProvider(modelName);

  switch (provider) {
    case 'groq': {
      const groq = getGroqClient();
      if (!groq) {
        console.warn(
          `[AI Provider] GROQ_API_KEY not set, falling back to Gemini for model: ${modelName}`,
        );
        return google(PROVIDER_MODELS.gemini.default);
      }
      const model = modelName || PROVIDER_MODELS.groq.default;
      console.log(`[AI Provider] Using Groq with model: ${model}`);
      return groq(model);
    }

    case 'gemini':
    default: {
      const model = modelName || PROVIDER_MODELS.gemini.default;
      console.log(`[AI Provider] Using Gemini with model: ${model}`);
      return google(model);
    }
  }
}

/**
 * Get the default chat model (Gemini Flash)
 * Use this for internal operations like title generation
 */
export function getDefaultChatModel() {
  return google(PROVIDER_MODELS.gemini.default);
}

/**
 * Get the pro chat model (Gemini Pro)
 * Use this for complex reasoning tasks
 */
export function getProChatModel() {
  return google(PROVIDER_MODELS.gemini.pro);
}

/**
 * Check if a specific provider is available (has API key configured)
 */
export function isProviderAvailable(provider: ProviderType): boolean {
  switch (provider) {
    case 'groq':
      return !!process.env.GROQ_API_KEY;
    case 'gemini':
      return !!process.env.GEMINI_API_KEY;
    default:
      return false;
  }
}

/**
 * Get list of available providers
 */
export function getAvailableProviders(): ProviderType[] {
  const providers: ProviderType[] = [];
  if (process.env.GEMINI_API_KEY) providers.push('gemini');
  if (process.env.GROQ_API_KEY) providers.push('groq');
  return providers;
}
