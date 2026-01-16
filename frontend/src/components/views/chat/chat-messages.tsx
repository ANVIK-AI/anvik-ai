import { useChat, useCompletion } from '@ai-sdk/react';
import { cn } from '@lib/utils';
import { Button } from '@ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/select';
import { DefaultChatTransport } from 'ai';
import { ArrowUp, Copy, RotateCcw, Sparkles, MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';
import { TextShimmer } from '@/components/text-shimmer';
import { useProject } from '@/stores';
import { usePersistentChat } from '@/stores/chat';
import { useGraphHighlights } from '@/stores/highlights';
import { Spinner } from '../../spinner';
import { useAuth } from '@/context/AuthContext';

// Import tool card components
import {
  GetEmailsCard,
  GetEmailDetailsCard,
  SendEmailCard,
  GetCalendarEventsCard,
  SetCalendarEventCard,
  ListCalendarTasksCard,
  SetCalendarTaskCard,
  SearchMemoriesCard,
  AddMemoryCard,
  FetchMemoryCard,
  ToolCallGroup,
  MultiStepProgress,
  invocationStateToToolState,
  type ToolState,
  type ToolInvocation,
} from './tool-cards';

// Custom hook for sticky auto scroll behavior
function useStickyAutoScroll(triggerKeys: ReadonlyArray<unknown>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [isFarFromBottom, setIsFarFromBottom] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const node = bottomRef.current;
    if (node) node.scrollIntoView({ behavior, block: 'end' });
  }, []);

  useEffect(function observeBottomVisibility() {
    const container = scrollContainerRef.current;
    const sentinel = bottomRef.current;
    if (!container || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries || entries.length === 0) return;
        const isIntersecting = entries.some((e) => e.isIntersecting);
        setIsAutoScroll(isIntersecting);
      },
      { root: container, rootMargin: '0px 0px 80px 0px', threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(
    function observeContentResize() {
      const container = scrollContainerRef.current;
      if (!container) return;
      const resizeObserver = new ResizeObserver(() => {
        if (isAutoScroll) scrollToBottom('auto');
        const distanceFromBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight;
        setIsFarFromBottom(distanceFromBottom > 100);
      });
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    },
    [isAutoScroll, scrollToBottom],
  );

  function enableAutoScroll() {
    setIsAutoScroll(true);
  }

  useEffect(
    function autoScrollOnNewContent() {
      if (isAutoScroll) scrollToBottom('auto');
    },
    [isAutoScroll, scrollToBottom, ...triggerKeys],
  );

  const recomputeDistanceFromBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsFarFromBottom(distanceFromBottom > 100);
  }, []);

  useEffect(() => {
    recomputeDistanceFromBottom();
  }, [recomputeDistanceFromBottom, ...triggerKeys]);

  function onScroll() {
    recomputeDistanceFromBottom();
  }

  return {
    scrollContainerRef,
    bottomRef,
    isAutoScroll,
    isFarFromBottom,
    onScroll,
    enableAutoScroll,
    scrollToBottom,
  } as const;
}

// Enhanced thinking indicator component
function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3 p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex-shrink-0">
        <MessageSquare className="size-4 text-indigo-600 animate-pulse" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <TextShimmer className="text-sm font-medium text-gray-700" duration={1.5}>
            Thinking...
          </TextShimmer>
        </div>
        <div className="flex gap-1 mt-2">
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}

// Tool part renderer component - maps tool invocations to their card components
function ToolInvocationRenderer({
  invocation,
  messageId,
  index,
}: {
  invocation: ToolInvocation;
  messageId: string;
  index: number;
}) {
  const state = invocationStateToToolState(invocation);
  const key = `${messageId}-${invocation.toolName}-${index}`;
  const toolName = invocation.toolName;

  // Handle different tool types
  switch (toolName) {
    // Memory Tools
    case 'search_memories':
      return <SearchMemoriesCard key={key} state={state} output={invocation.result as any} />;

    case 'add_memory':
      return (
        <AddMemoryCard
          key={key}
          state={state}
          input={invocation.args as any}
          output={invocation.result}
        />
      );

    case 'fetch_memory':
      return <FetchMemoryCard key={key} state={state} output={invocation.result as any} />;

    // Email Tools
    case 'get_emails':
      return <GetEmailsCard key={key} state={state} output={invocation.result as any} />;

    case 'get_email_details':
      return <GetEmailDetailsCard key={key} state={state} output={invocation.result as any} />;

    case 'send_email':
      return (
        <SendEmailCard
          key={key}
          state={state}
          input={invocation.args as any}
          output={invocation.result as any}
        />
      );

    // Calendar Tools
    case 'set_calendar_event':
      return (
        <SetCalendarEventCard
          key={key}
          state={state}
          input={invocation.args as any}
          output={invocation.result as any}
        />
      );

    case 'get_calendar_events':
      return <GetCalendarEventsCard key={key} state={state} output={invocation.result as any} />;

    // Task Tools
    case 'set_calendar_task':
      return (
        <SetCalendarTaskCard
          key={key}
          state={state}
          input={invocation.args as any}
          output={invocation.result as any}
        />
      );

    case 'list_calendar_tasks':
      return <ListCalendarTasksCard key={key} state={state} output={invocation.result as any} />;

    default:
      // For unknown tools, show a generic loading/success state
      const displayName = toolName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

      if (state === 'input-available' || state === 'input-streaming') {
        return (
          <div
            key={key}
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-gray-50 animate-in fade-in duration-300"
          >
            <Spinner className="size-4 text-gray-600" />
            <span className="text-sm text-gray-700">Processing {displayName}...</span>
          </div>
        );
      }

      if (state === 'output-error') {
        return (
          <div
            key={key}
            className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50 animate-in fade-in duration-300"
          >
            <span className="text-sm text-red-700">Error with {displayName}</span>
          </div>
        );
      }

      if (state === 'output-available') {
        return (
          <div
            key={key}
            className="flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50 animate-in fade-in duration-300"
          >
            <span className="text-sm text-green-700">{displayName} completed</span>
          </div>
        );
      }

      return null;
  }
}

// Legacy tool part renderer for backward compatibility with old message format
function ToolPartRenderer({
  part,
  messageId,
  index,
}: {
  part: any;
  messageId: string;
  index: number;
}) {
  const state = part.state as ToolState;
  const key = `${messageId}-${part.type}-${index}`;

  // Handle different tool types
  switch (part.type) {
    // Memory Tools
    case 'tool-searchMemories':
    case 'tool-search_memories':
      return <SearchMemoriesCard key={key} state={state} output={part.output} />;

    case 'tool-addMemory':
    case 'tool-add_memory':
      return <AddMemoryCard key={key} state={state} input={part.input} output={part.output} />;

    case 'tool-fetch_memory':
    case 'tool-fetchMemory':
      return <FetchMemoryCard key={key} state={state} output={part.output} />;

    // Email Tools
    case 'tool-get_emails':
    case 'tool-getEmails':
      return <GetEmailsCard key={key} state={state} output={part.output} />;

    case 'tool-get_email_details':
    case 'tool-get-email-details':
    case 'tool-getEmailDetails':
      return <GetEmailDetailsCard key={key} state={state} output={part.output} />;

    case 'tool-send_email':
    case 'tool-sendEmail':
      return <SendEmailCard key={key} state={state} input={part.input} output={part.output} />;

    // Calendar Tools
    case 'tool-set_calendar_event':
    case 'tool-setCalendarEvent':
      return (
        <SetCalendarEventCard key={key} state={state} input={part.input} output={part.output} />
      );

    case 'tool-get_calendar_events':
    case 'tool-getCalendarEvents':
      return <GetCalendarEventsCard key={key} state={state} output={part.output} />;

    // Task Tools
    case 'tool-set_calendar_task':
    case 'tool-setCalendarTask':
      return (
        <SetCalendarTaskCard key={key} state={state} input={part.input} output={part.output} />
      );

    case 'tool-list_calendar_tasks':
    case 'tool-listCalendarTasks':
      return <ListCalendarTasksCard key={key} state={state} output={part.output} />;

    default:
      // For unknown tools, show a generic loading/success state
      if (part.type?.startsWith('tool-')) {
        const toolName = part.type.replace('tool-', '').replace(/_/g, ' ');

        if (state === 'input-available' || state === 'input-streaming') {
          return (
            <div
              key={key}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-gray-50 animate-in fade-in duration-300"
            >
              <Spinner className="size-4 text-gray-600" />
              <span className="text-sm text-gray-700">Processing {toolName}...</span>
            </div>
          );
        }

        if (state === 'output-error') {
          return (
            <div
              key={key}
              className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50 animate-in fade-in duration-300"
            >
              <span className="text-sm text-red-700">Error with {toolName}</span>
            </div>
          );
        }

        if (state === 'output-available') {
          return (
            <div
              key={key}
              className="flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50 animate-in fade-in duration-300"
            >
              <span className="text-sm text-green-700">{toolName} completed</span>
            </div>
          );
        }
      }

      return null;
  }
}

// Helper function to group tool invocations into steps
function groupToolInvocationsIntoSteps(
  toolInvocations: ToolInvocation[],
): { stepNumber: number; invocations: ToolInvocation[] }[] {
  // For now, treat each tool call as its own step (sequential)
  // In the future, we could detect parallel calls and group them
  return toolInvocations.map((inv, idx) => ({
    stepNumber: idx + 1,
    invocations: [inv],
  }));
}

// Message renderer component - handles both old and new message formats
function MessageRenderer({
  message,
  onCopy,
  onRegenerate,
}: {
  message: any;
  onCopy: () => void;
  onRegenerate: () => void;
}) {
  // Extract tool invocations if present (new AI SDK format)
  const toolInvocations: ToolInvocation[] = useMemo(() => {
    // Check for toolInvocations on the message (new format)
    if (message.toolInvocations && Array.isArray(message.toolInvocations)) {
      return message.toolInvocations.map((inv: any) => ({
        toolCallId: inv.toolCallId || inv.id,
        toolName: inv.toolName,
        args: inv.args || {},
        state: inv.state || (inv.result !== undefined ? 'result' : 'call'),
        result: inv.result,
        error: inv.error,
      }));
    }
    return [];
  }, [message.toolInvocations]);

  // Check if we have tool invocations in the new format
  const hasToolInvocations = toolInvocations.length > 0;

  // Group tool invocations into steps
  const toolSteps = useMemo(
    () => groupToolInvocationsIntoSteps(toolInvocations),
    [toolInvocations],
  );

  // Get text parts from the message
  const textParts = useMemo(() => {
    if (!message.parts) return [];
    return message.parts.filter((p: any) => p.type === 'text');
  }, [message.parts]);

  // Get legacy tool parts (old format with tool- prefix types)
  const legacyToolParts = useMemo(() => {
    if (!message.parts) return [];
    return message.parts.filter(
      (p: any) => typeof p.type === 'string' && p.type.startsWith('tool-'),
    );
  }, [message.parts]);

  // Decide which format to use
  const useLegacyFormat = legacyToolParts.length > 0 && !hasToolInvocations;

  return (
    <div
      className={cn(
        'flex animate-in fade-in slide-in-from-bottom-2 duration-300',
        message.role === 'user' ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-3 max-w-[85%]',
          message.role === 'user' ? 'items-end' : 'items-start',
        )}
      >
        {/* Render tool invocations first (if using new format) */}
        {hasToolInvocations && (
          <div className="w-full space-y-3">
            {/* Multi-step progress indicator */}
            {toolSteps.length > 1 && (
              <MultiStepProgress currentStep={toolSteps.length} totalSteps={toolSteps.length} />
            )}

            {/* Tool call groups */}
            {toolSteps.map((step, stepIdx) => (
              <ToolCallGroup
                key={`step-${step.stepNumber}`}
                stepNumber={step.stepNumber}
                totalSteps={toolSteps.length > 1 ? toolSteps.length : undefined}
                toolInvocations={step.invocations}
                isActive={stepIdx === toolSteps.length - 1}
              >
                {step.invocations.map((inv, invIdx) => (
                  <ToolInvocationRenderer
                    key={inv.toolCallId || `${message.id}-tool-${invIdx}`}
                    invocation={inv}
                    messageId={message.id}
                    index={invIdx}
                  />
                ))}
              </ToolCallGroup>
            ))}
          </div>
        )}

        {/* Render legacy tool parts (old format) */}
        {useLegacyFormat &&
          legacyToolParts.map((part: any, index: number) => (
            <ToolPartRenderer
              key={`${message.id}-${part.type}-${index}`}
              part={part}
              messageId={message.id}
              index={index}
            />
          ))}

        {/* Render text parts */}
        {textParts.map((part: any, index: number) => (
          <div
            key={`${message.id}-text-${index}`}
            className={cn(
              'rounded-2xl shadow-sm',
              message.role === 'user'
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-4 py-3'
                : 'bg-white border border-gray-200 px-4 py-3',
            )}
          >
            <Streamdown className={cn(message.role === 'user' ? 'text-white' : 'text-gray-900')}>
              {part.text}
            </Streamdown>
          </div>
        ))}

        {/* Also render content if it's a plain string (fallback) */}
        {typeof message.content === 'string' && message.content && textParts.length === 0 && (
          <div
            className={cn(
              'rounded-2xl shadow-sm',
              message.role === 'user'
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-4 py-3'
                : 'bg-white border border-gray-200 px-4 py-3',
            )}
          >
            <Streamdown className={cn(message.role === 'user' ? 'text-white' : 'text-gray-900')}>
              {message.content}
            </Streamdown>
          </div>
        )}

        {/* Action buttons for assistant messages */}
        {message.role === 'assistant' && (textParts.length > 0 || message.content) && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
            <Button
              className="h-7 w-7 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              onClick={onCopy}
              size="icon"
              variant="ghost"
            >
              <Copy className="size-3.5" />
            </Button>
            <Button
              className="h-7 w-7 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              onClick={onRegenerate}
              size="icon"
              variant="ghost"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatMessages() {
  const { user } = useAuth();
  const { selectedProject, setSelectedProject } = useProject();
  const { id: routeChatId } = useParams();
  const {
    currentChatId,
    setCurrentChatId,
    setConversation,
    getCurrentConversation,
    setConversationTitle,
    getCurrentChat,
  } = usePersistentChat();

  const storageKey = `chat-model-${currentChatId}`;

  // Available AI models - Gemini (default) and Groq models
  type ModelType =
    | 'gemini-2.5-flash'
    | 'gemini-2.5-pro'
    | 'qwen/qwen3-32b'
    | 'llama-3.3-70b-versatile'
    | 'deepseek-r1-distill-llama-70b';

  const MODEL_OPTIONS: { value: ModelType; label: string; provider: string }[] = [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google' },
    { value: 'qwen/qwen3-32b', label: 'Qwen3 32B', provider: 'Groq' },
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', provider: 'Groq' },
    { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B', provider: 'Groq' },
  ];

  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<ModelType>(
    (sessionStorage.getItem(storageKey) as ModelType) || 'gemini-2.5-flash',
  );

  // Persist model selection to sessionStorage
  useEffect(() => {
    if (selectedModel) {
      sessionStorage.setItem(storageKey, selectedModel);
    }
  }, [selectedModel, storageKey]);

  const activeChatIdRef = useRef<string | null>(null);
  const shouldGenerateTitleRef = useRef<boolean>(false);
  const hasRunInitialMessageRef = useRef<boolean>(false);

  const { setDocumentIds } = useGraphHighlights();

  const { messages, sendMessage, status, stop, setMessages, id, regenerate } = useChat({
    id: currentChatId ?? undefined,
    transport: new DefaultChatTransport({
      api: `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/chat${currentChatId ? `/${currentChatId}` : ''}`,
      fetch: (url, options: any) => {
        let original: any = {};
        if (options?.body) {
          try {
            original = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
          } catch (e) {
            console.error('Failed to parse request body:', e);
          }
        }
        // Properly handle headers to avoid duplication
        const headers = new Headers(options?.headers || {});
        headers.set('Content-Type', 'application/json');

        const requestBody = JSON.stringify({
          ...original, // preserve id, trigger, messages, etc.
          metadata: {
            ...(original?.metadata ?? {}),
            projectId: selectedProject ?? 'sm_project_default',
            model: selectedModel,
          },
        });

        // Add timeout to prevent hanging (5 minutes for streaming responses)
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => {
            controller.abort();
          },
          5 * 60 * 1000,
        ); // 5 minutes

        return fetch(url, {
          ...options,
          body: requestBody,
          credentials: 'include',
          signal: controller.signal,
          headers,
        }).finally(() => {
          clearTimeout(timeoutId);
        });
      },
    }),
    onFinish: (result) => {
      console.log('Message finished:', result);
      const activeId = activeChatIdRef.current;
      if (!activeId) return;
      if (result.message.role !== 'assistant') return;

      if (shouldGenerateTitleRef.current) {
        const textPart = result.message.parts.find((p: any) => p?.type === 'text') as any;
        const text = textPart?.text?.trim();
        if (text) {
          shouldGenerateTitleRef.current = false;
          complete(text);
        }
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while chatting';

      // Determine current provider for error context
      const isGroqModel =
        selectedModel.includes('qwen') ||
        selectedModel.includes('llama') ||
        selectedModel.includes('deepseek');
      const providerName = isGroqModel ? 'Groq' : 'Gemini';

      // Show user-friendly error message with provider context
      if (
        errorMessage.includes('connect') ||
        errorMessage.includes('network') ||
        errorMessage.includes('fetch')
      ) {
        toast.error(
          'Unable to connect to the chat service. Please check your internet connection and try again.',
        );
      } else if (errorMessage.includes('AI service') || errorMessage.includes('ENOTFOUND')) {
        toast.error(
          `Unable to reach the ${providerName} AI service. Please check your internet connection and try again.`,
        );
      } else if (
        errorMessage.includes('API key') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403')
      ) {
        toast.error(
          `${providerName} API key is invalid or not configured. Please check the backend configuration.`,
        );
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        toast.error(
          `${providerName} rate limit exceeded. Please wait a moment and try again, or switch to a different model.`,
        );
      } else if (errorMessage.includes('model') || errorMessage.includes('not found')) {
        toast.error(
          `The selected model "${selectedModel}" is not available. Please try a different model.`,
        );
      } else {
        toast.error(`Chat error: ${errorMessage}`);
      }
    },
  });

  // Note: AI SDK with maxSteps handles multi-step tool calling automatically
  // No manual tool result submission needed

  useEffect(() => {
    // Ensure store chat id matches the route param on mount/navigation
    if (routeChatId && routeChatId !== currentChatId) {
      setCurrentChatId(routeChatId);
    }
  }, [routeChatId]);

  useEffect(() => {
    activeChatIdRef.current = currentChatId ?? id ?? null;
  }, [currentChatId, id]);

  // Set selected project from user's first spaceId if available
  useEffect(() => {
    if (user?.spaceIds && user.spaceIds.length > 0) {
      // If current selectedProject is not in user's spaceIds (or is default), set to first spaceId
      const isValidProject = selectedProject && user.spaceIds.includes(selectedProject);
      if (
        !isValidProject ||
        selectedProject === 'sm_project_default' ||
        selectedProject === '93c73846-5c10-4325-968e-41be4baa2dbd'
      ) {
        setSelectedProject(user.spaceIds[0]);
      }
    }
  }, [user, selectedProject, setSelectedProject]);

  useEffect(() => {
    if (currentChatId) {
      const savedModel = sessionStorage.getItem(storageKey) as ModelType | null;
      const validModels: ModelType[] = MODEL_OPTIONS.map((m) => m.value);

      if (savedModel && validModels.includes(savedModel)) {
        setSelectedModel(savedModel);
      }
    }
  }, [currentChatId]);

  useEffect(() => {
    if (currentChatId && !hasRunInitialMessageRef.current) {
      // Check if there's an initial message from the home page in sessionStorage
      const storageKey = `chat-initial-${currentChatId}`;
      const initialMessage = sessionStorage.getItem(storageKey);

      if (initialMessage) {
        // Clean up the storage and send the message
        sessionStorage.removeItem(storageKey);
        sendMessage({ text: initialMessage });
        hasRunInitialMessageRef.current = true;
      }
    }
  }, [currentChatId]);

  useEffect(() => {
    if (id && id !== currentChatId) {
      setCurrentChatId(id);
    }
  }, [id]);

  useEffect(() => {
    const msgs = getCurrentConversation();
    if (msgs && msgs.length > 0) {
      setMessages(msgs);
    } else if (!currentChatId) {
      setMessages([]);
    }
    setInput('');
  }, [currentChatId]);

  useEffect(() => {
    const activeId = currentChatId ?? id;
    if (activeId && messages.length > 0) {
      setConversation(activeId, messages);
    }
  }, [messages, currentChatId, id]);

  const { complete } = useCompletion({
    api: `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/chat/title`,
    credentials: 'include',
    onFinish: (_, completion) => {
      const activeId = activeChatIdRef.current;
      if (!completion || !activeId) return;
      setConversationTitle(activeId, completion.trim());
    },
  });

  // Update graph highlights from the most recent search_memories tool output
  useEffect(() => {
    try {
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant') as any;
      if (!lastAssistant) return;

      let documentIds: string[] = [];

      // Check new format (toolInvocations array)
      if (lastAssistant.toolInvocations && Array.isArray(lastAssistant.toolInvocations)) {
        const searchInvocation = [...lastAssistant.toolInvocations]
          .reverse()
          .find((inv: any) => inv.toolName === 'search_memories' && inv.state === 'result');
        if (searchInvocation && searchInvocation.result) {
          const results = searchInvocation.result.results;
          if (Array.isArray(results)) {
            documentIds = results.map((r: any) => r?.documentId).filter(Boolean);
          }
        }
      }

      // Fallback to legacy format (parts with tool- prefix)
      if (documentIds.length === 0 && lastAssistant.parts) {
        const lastSearchPart = [...(lastAssistant.parts as any[])]
          .reverse()
          .find(
            (p) =>
              (p?.type === 'tool-searchMemories' || p?.type === 'tool-search_memories') &&
              p?.state === 'output-available',
          );
        if (lastSearchPart) {
          const output = (lastSearchPart as any).output;
          if (Array.isArray(output?.results)) {
            documentIds = output.results.map((r: any) => r?.documentId).filter(Boolean);
          }
        }
      }

      if (documentIds.length > 0) {
        setDocumentIds(documentIds);
      }
    } catch {}
  }, [messages]);

  useEffect(() => {
    const currentSummary = getCurrentChat();
    const hasTitle = Boolean(currentSummary?.title && currentSummary.title.trim().length > 0);
    shouldGenerateTitleRef.current = !hasTitle;
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage({ text: input });
      setInput('');
    }
  };

  const {
    scrollContainerRef,
    bottomRef,
    isFarFromBottom,
    onScroll,
    enableAutoScroll,
    scrollToBottom,
  } = useStickyAutoScroll([messages, status]);

  return (
    <div className="h-screen flex flex-col w-full bg-gradient-to-b from-gray-50 to-white">
      {/* Chat Messages Area */}
      <div className="flex-1 relative">
        <div
          className="flex flex-col gap-4 absolute inset-0 overflow-y-auto px-4 pt-4 pb-7 scroll-pb-7 custom-scrollbar"
          onScroll={onScroll}
          ref={scrollContainerRef}
        >
          {messages.map((message) => (
            <MessageRenderer
              key={message.id}
              message={message}
              onCopy={() => {
                navigator.clipboard.writeText(
                  message.parts
                    .filter((p) => p.type === 'text')
                    ?.map((p) => (p as any).text)
                    .join('\n') ?? '',
                );
                toast.success('Copied to clipboard');
              }}
              onRegenerate={() => regenerate({ messageId: message.id })}
            />
          ))}

          {/* Thinking indicator */}
          {status === 'submitted' && <ThinkingIndicator />}

          <div ref={bottomRef} />
        </div>

        {/* Scroll to bottom button */}
        <Button
          className={cn(
            'rounded-full w-fit mx-auto shadow-lg z-10 absolute inset-x-0 bottom-4 flex justify-center',
            'transition-all duration-200 ease-out bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
            isFarFromBottom
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-95 pointer-events-none',
          )}
          onClick={() => {
            enableAutoScroll();
            scrollToBottom('smooth');
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Scroll to bottom
        </Button>
      </div>

      {/* Input Area */}
      <div className="px-4 pb-4 pt-2 relative flex-shrink-0">
        <form
          className="flex bg-white flex-col items-end gap-3 border border-gray-200 rounded-2xl p-3 relative shadow-lg hover:shadow-xl transition-shadow"
          onSubmit={(e) => {
            e.preventDefault();
            if (status === 'submitted') return;
            if (status === 'streaming') {
              stop();
              return;
            }
            if (input.trim()) {
              enableAutoScroll();
              scrollToBottom('auto');
              sendMessage({ text: input });
              setInput('');
            }
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your follow-up question..."
            className="w-full text-gray-900 placeholder:text-gray-400 rounded-md outline-none resize-none text-base leading-relaxed px-3 py-2 bg-transparent focus:ring-0"
            rows={3}
          />
          <div className="flex items-center justify-between w-full">
            {/* Model Selector */}
            <Select
              value={selectedModel}
              onValueChange={(value: ModelType) => setSelectedModel(value)}
            >
              <SelectTrigger className="h-8 w-auto gap-1.5 border-none shadow-none bg-gray-100 hover:bg-gray-200 text-xs text-gray-700 rounded-lg transition-colors">
                <Sparkles className="size-3.5 text-indigo-500" />
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    <div className="flex items-center gap-2">
                      <span>{model.label}</span>
                      <span className="text-xs text-muted-foreground">({model.provider})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={!input.trim() || status === 'submitted'}
              className={cn(
                'rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg',
              )}
              size="icon"
            >
              {status === 'submitted' ? (
                <Spinner className="size-4" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
