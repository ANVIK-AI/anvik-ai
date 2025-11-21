import { useChat, useCompletion } from '@ai-sdk/react';
import { cn } from '@lib/utils';
import { Button } from '@ui/components/button';
import { DefaultChatTransport } from 'ai';
import { ArrowUp, Calendar, Check, ChevronDown, ChevronRight, Clock, Copy, Mail, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';
import { TextShimmer } from '@/components/text-shimmer';
import { useProject } from '@/stores';
import { usePersistentChat } from '@/stores/chat';
import { useGraphHighlights } from '@/stores/highlights';
import { Spinner } from '../../spinner';
import { nanoid } from 'nanoid';
import { useAuth } from '@/context/AuthContext';

interface MemoryResult {
  documentId?: string;
  title?: string;
  content?: string;
  url?: string;
  score?: number;
}

interface ExpandableMemoriesProps {
  foundCount: number;
  results: MemoryResult[];
}

function ExpandableMemories({ foundCount, results }: ExpandableMemoriesProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (foundCount === 0) {
    return (
      <div className="text-sm flex items-center gap-2 text-muted-foreground">
        <Check className="size-4" /> No memories found
      </div>
    );
  }

  return (
    <div className="text-sm">
      <button
        className="flex items-center gap-2 text-muted-foreground transition-colors text-gray-900"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        Related memories
      </button>

      {isExpanded && results.length > 0 && (
        <div className="mt-2 ml-6 space-y-2 max-h-48 overflow-y-auto grid grid-cols-3 gap-2">
          {results.map((result, index) => {
            const isClickable =
              result.url && (result.url.startsWith('http://') || result.url.startsWith('https://'));

            const content = (
              <div className="text-gray-900">
                {result.title && <div className="font-medium text-sm mb-1">{result.title}</div>}
                {result.content && (
                  <div className="text-xs text-muted-foreground line-clamp-2">{result.content}</div>
                )}
                {result.url && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 truncate">
                    {result.url}
                  </div>
                )}
                {result.score && (
                  <div className="text-xs text-muted-slate-200 mt-1">
                    Score: {(result.score * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            );

            if (isClickable) {
              return (
                <a
                  className="block p-2 bg-accent/50 rounded-md border border-border hover:bg-accent transition-colors cursor-pointer"
                  href={result.url}
                  key={result.documentId || index}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {content}
                </a>
              );
            }

            return (
              <div
                className="p-2 bg-accent/50 rounded-md border border-border bg-white"
                key={result.documentId || index}
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface EmailResult {
  id?: string;
  threadId?: string;
  subject?: string;
  from?: string;
  date?: string;
  snippet?: string;
}

interface ExpandableEmailsProps {
  foundCount: number;
  results: EmailResult[];
  category?: string;
}

function ExpandableEmails({ foundCount, results, category }: ExpandableEmailsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper function to decode HTML entities in snippet
  const decodeHtml = (html: string) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  // Helper function to format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return dateStr;
    }
  };

  // Helper function to extract email address from "Name <email@domain.com>" format
  const extractEmailAddress = (fromStr?: string) => {
    if (!fromStr) return '';
    const match = fromStr.match(/<([^>]+)>/);
    return match ? match[1] : fromStr;
  };

  if (foundCount === 0) {
    return (
      <div className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900">
        <Check className="size-4" /> No emails found{category ? ` in ${category}` : ''}
      </div>
    );
  }

  return (
    <div className="text-sm">
      <button
        className="flex items-center gap-2 text-muted-foreground transition-colors text-gray-900"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        {foundCount} email{foundCount !== 1 ? 's' : ''} found{category ? ` in ${category}` : ''}
      </button>

      {isExpanded && results.length > 0 && (
        <div className="mt-2 ml-6 space-y-2 max-h-96 overflow-y-auto">
          {results.map((email, index) => (
            <div
              className="p-3 bg-accent/50 rounded-md border border-border bg-white hover:bg-accent transition-colors"
              key={email.id || email.threadId || index}
            >
              <div className="text-gray-900">
                {email.subject && (
                  <div className="font-medium text-sm mb-1.5 flex items-start gap-2">
                    <Mail className="size-4 mt-0.5 flex-shrink-0 text-blue-600" />
                    <span className="flex-1">{email.subject}</span>
                  </div>
                )}
                {email.from && (
                  <div className="text-xs text-muted-foreground mb-1">
                    From: <span className="font-medium">{extractEmailAddress(email.from)}</span>
                  </div>
                )}
                {email.date && (
                  <div className="text-xs text-muted-foreground mb-2">
                    {formatDate(email.date)}
                  </div>
                )}
                {email.snippet && (
                  <div className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {decodeHtml(email.snippet)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface EmailDetailsData {
  id?: string;
  threadId?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  snippet?: string;
  body?: string; // HTML content
}

interface EmailDetailsProps {
  email: EmailDetailsData;
}

function EmailDetails({ email }: EmailDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Helper function to format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Helper function to extract email address from "Name <email@domain.com>" format
  const extractEmailAddress = (emailStr?: string) => {
    if (!emailStr) return '';
    const match = emailStr.match(/<([^>]+)>/);
    return match ? match[1] : emailStr;
  };

  // Helper function to extract name from "Name <email@domain.com>" format
  const extractName = (emailStr?: string) => {
    if (!emailStr) return '';
    const match = emailStr.match(/^(.+?)\s*<(.+)>$/);
    return match ? match[1].trim().replace(/['"]/g, '') : '';
  };

  return (
    <div className="text-sm">
      <button
        className="flex items-center gap-2 text-muted-foreground transition-colors text-gray-900"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        Email details
      </button>

      {isExpanded && (
        <div className="mt-2 ml-6 bg-accent/50 rounded-md border border-border bg-white p-4">
          <div className="text-gray-900 space-y-3">
            {email.subject && (
              <div className="font-medium text-base mb-2 flex items-start gap-2">
                <Mail className="size-5 mt-0.5 flex-shrink-0 text-blue-600" />
                <span className="flex-1">{email.subject}</span>
              </div>
            )}

            <div className="space-y-1.5 text-xs border-b border-border pb-3">
              {email.from && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[3rem]">From:</span>
                  <span className="text-gray-900">
                    {extractName(email.from) && (
                      <span className="font-medium">{extractName(email.from)} </span>
                    )}
                    <span className="text-blue-600">{extractEmailAddress(email.from)}</span>
                  </span>
                </div>
              )}
              {email.to && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[3rem]">To:</span>
                  <span className="text-gray-900">{extractEmailAddress(email.to)}</span>
                </div>
              )}
              {email.date && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[3rem]">Date:</span>
                  <span className="text-gray-900">{formatDate(email.date)}</span>
                </div>
              )}
            </div>

            {email.body && (
              <div className="mt-3">
                <div
                  className="email-body prose prose-sm max-w-none text-gray-900"
                  dangerouslySetInnerHTML={{ __html: email.body }}
                  style={{
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: '14px',
                    lineHeight: '1.5',
                  }}
                />
              </div>
            )}
            {email.snippet && !email.body && (
              <div className="mt-3 text-xs text-muted-foreground leading-relaxed">
                {email.snippet}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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

export function ChatMessages() {
  const {user}=useAuth();
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

  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<
    'gpt-5' | 'claude-sonnet-4.5' | 'gemini-2.5-pro'
  >(
    (sessionStorage.getItem(storageKey) as 'gpt-5' | 'claude-sonnet-4.5' | 'gemini-2.5-pro') ||
      'gemini-2.5-pro',
  );
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
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 5 * 60 * 1000); // 5 minutes

        return fetch(url, {
          ...options,
          body: requestBody,
          credentials: 'include',
          signal: controller.signal,
          headers,
          // include cookies if backend uses them; harmless otherwise
          // credentials: (options as any)?.credentials ?? "include",
        }).finally(() => {
          clearTimeout(timeoutId);
        });
      },
    }),
    onFinish: (result) => {
      console.log('✅ Message finished:', result);
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
      console.error('❌ Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while chatting';
      
      // Show user-friendly error message
      if (errorMessage.includes('connect') || errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error('Unable to connect to the chat service. Please check your internet connection and try again.');
      } else if (errorMessage.includes('AI service') || errorMessage.includes('ENOTFOUND')) {
        toast.error('Unable to reach the AI service. Please check your internet connection and try again.');
      } else {
        toast.error(`Chat error: ${errorMessage}`);
      }
    },
  });

  // Automatically submit tool results back to the backend when available
  const processedToolCallsRef = useRef<Set<string>>(new Set());
  const isSubmittingToolRef = useRef<boolean>(false);

  useEffect(() => {
    // Find the most recent assistant message containing a tool with output-available
    const assistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!assistant) return;
    const toolPart = [...(assistant.parts as any[])]
      .reverse()
      .find(
        (p) =>
          typeof p?.type === 'string' &&
          p.type.startsWith('tool-') &&
          p?.state === 'output-available',
      ) as any | undefined;
    if (!toolPart) return;

    const toolCallId: string | undefined = toolPart.toolCallId || toolPart.id;
    if (!toolCallId) return;
    if (processedToolCallsRef.current.has(toolCallId)) return;
    if (isSubmittingToolRef.current) return;

    const activeId = activeChatIdRef.current;
    if (!activeId) return;

    // Submit the tool result to progress the conversation
    const submit = async () => {
      try {
        isSubmittingToolRef.current = true;
        processedToolCallsRef.current.add(toolCallId);

        const url = `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/chat/${activeId}`;

        const payload = {
          id: activeId,
          messages,
          trigger: 'submit-tool-result',
          metadata: {
            projectId: selectedProject ?? 'sm_project_default',
            model: selectedModel,
          },
        };

        const headers = new Headers();
        headers.set('Content-Type', 'application/json');
        headers.set('Accept', 'text/event-stream');

        const controller = new AbortController();
        const signal = controller.signal;

        // Create a new streaming assistant message to render the final answer
        const streamingId = `assistant-${nanoid(8)}`;
        setMessages((prev: any[]) => [
          ...prev,
          {
            id: streamingId,
            role: 'assistant',
            parts: [],
          },
        ]);

        const res = await fetch(url, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload),
          signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Tool follow-up failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let textStarted = false;

        const flushEvents = (chunk: string) => {
          buffer += chunk;
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const raw = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 2);
            if (!raw) continue;
            const lines = raw.split('\n');
            for (const line of lines) {
              const prefix = 'data: ';
              if (!line.startsWith(prefix)) continue;
              const data = line.slice(prefix.length).trim();
              if (data === '[DONE]') {
                return { done: true } as const;
              }
              try {
                const evt = JSON.parse(data);
                // Handle the minimal set of events we care about
                switch (evt?.type) {
                  case 'text-start': {
                    textStarted = true;
                    // initialize a text part
                    setMessages((prev: any[]) =>
                      prev.map((m) =>
                        m.id === streamingId
                          ? {
                              ...m,
                              parts: [...m.parts, { type: 'text', id: evt.id ?? '0', text: '' }],
                            }
                          : m,
                      ),
                    );
                    break;
                  }
                  case 'text-delta': {
                    const delta = evt?.delta ?? '';
                    if (!delta) break;
                    setMessages((prev: any[]) =>
                      prev.map((m) => {
                        if (m.id !== streamingId) return m;
                        const parts = [...m.parts];
                        if (parts.length === 0) {
                          parts.push({ type: 'text', id: evt.id ?? '0', text: String(delta) });
                        } else {
                          const last = parts[parts.length - 1];
                          if (last.type === 'text') {
                            last.text = (last.text ?? '') + String(delta);
                          } else {
                            parts.push({ type: 'text', id: evt.id ?? '0', text: String(delta) });
                          }
                        }
                        return { ...m, parts };
                      }),
                    );
                    break;
                  }
                  case 'text-end': {
                    // nothing special; the text is already accumulated
                    break;
                  }
                  case 'finish': {
                    return { done: true } as const;
                  }
                  default:
                    break;
                }
              } catch (e) {
                // ignore malformed events
              }
            }
          }
          return { done: false } as const;
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const str = decoder.decode(value, { stream: true });
          const { done: finished } = flushEvents(str);
          if (finished) break;
        }

        // finalize text part with state done
        if (textStarted) {
          setMessages((prev: any[]) =>
            prev.map((m) =>
              m.id === streamingId
                ? {
                    ...m,
                    parts: m.parts.map((p: any) =>
                      p?.type === 'text' && p?.state !== 'done' ? { ...p, state: 'done' } : p,
                    ),
                  }
                : m,
            ),
          );
        }
      } catch (e) {
        console.error('Failed to submit tool result:', e);
      } finally {
        isSubmittingToolRef.current = false;
      }
    };

    // Fire and forget
    submit();
  }, [messages, selectedProject, selectedModel, setMessages]);

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
      if (!isValidProject || selectedProject === 'sm_project_default' || selectedProject === '93c73846-5c10-4325-968e-41be4baa2dbd') {
        setSelectedProject(user.spaceIds[0]);
      }
    }
  }, [user, selectedProject, setSelectedProject]);

  useEffect(() => {
    if (currentChatId) {
      const savedModel = sessionStorage.getItem(storageKey) as
        | 'gpt-5'
        | 'claude-sonnet-4.5'
        | 'gemini-2.5-pro';

      if (savedModel && ['gpt-5', 'claude-sonnet-4.5', 'gemini-2.5-pro'].includes(savedModel)) {
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

  // Update graph highlights from the most recent tool-searchMemories output
  useEffect(() => {
    try {
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      if (!lastAssistant) return;
      const lastSearchPart = [...(lastAssistant.parts as any[])]
        .reverse()
        .find((p) => p?.type === 'tool-searchMemories' && p?.state === 'output-available');
      if (!lastSearchPart) return;
      const output = (lastSearchPart as any).output;
      const ids = Array.isArray(output?.results)
        ? ((output.results as any[]).map((r) => r?.documentId).filter(Boolean) as string[])
        : [];
      if (ids.length > 0) {
        setDocumentIds(ids);
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
    <div className="h-screen flex flex-col w-full">
      <div className="flex-1 relative">
        <div
          className="flex flex-col gap-2 absolute inset-0 overflow-y-auto px-4 pt-4 pb-7 scroll-pb-7 custom-scrollbar"
          onScroll={onScroll}
          ref={scrollContainerRef}
        >
          {messages.map((message) => (
            <div
              className={cn(
                'flex my-2',
                message.role === 'user' ? 'items-center flex-row-reverse gap-2' : 'flex-col',
              )}
              key={message.id}
            >
              <div
                className={cn(
                  'flex flex-col gap-2 max-w-[80%] text-slate-200',
                  message.role === 'user'
                    ? 'bg-accent/50 px-3 py-1.5 border border-border rounded-lg text-gray-900 bg-white'
                    : '',
                )}
              >
                {message.parts
                  .filter((part) => {
                    if (part.type === 'text') return true;
                    // Render any tool parts
                    if (typeof part.type === 'string' && part.type.startsWith('tool-')) return true;
                    return false;
                  })
                  .map((part, index) => {
                    switch (part.type) {
                      case 'text':
                        return (
                          <div
                            className="bg-accent/50 p-2 rounded-lg text-gray-900 bg-white"
                            key={`${message.id}-${part.type}-${index}`}
                          >
                            <Streamdown className="text-gray-900">{part.text}</Streamdown>
                          </div>
                        );
                      case 'tool-searchMemories':
                      case 'tool-search_memories': {
                        switch (part.state) {
                          case 'input-available':
                          case 'input-streaming':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <Spinner className="size-4" /> Searching memories...
                              </div>
                            );
                          case 'output-error':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <X className="size-4" /> Error recalling memories
                              </div>
                            );
                          case 'output-available': {
                            const output = part.output;
                            const foundCount =
                              typeof output === 'object' && output !== null && 'count' in output
                                ? Number(output.count) || 0
                                : 0;
                            // @ts-expect-error
                            const results = Array.isArray(output?.results)
                              ? // @ts-expect-error
                                output.results
                              : [];

                            return (
                              <ExpandableMemories
                                foundCount={foundCount}
                                key={`${message.id}-${part.type}-${index}`}
                                results={results}
                              />
                            );
                          }
                          default:
                            return null;
                        }
                      }
                      case 'tool-addMemory':
                      case 'tool-add_memory': {
                        switch (part.state) {
                          case 'input-available':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <Spinner className="size-4" /> Adding memory...
                              </div>
                            );
                          case 'output-error':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <X className="size-4" /> Error adding memory
                              </div>
                            );
                          case 'output-available':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <Check className="size-4 text-gray-900" /> Memory added
                              </div>
                            );
                          case 'input-streaming':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <Spinner className="size-4 text-gray-900" /> Adding memory...
                              </div>
                            );
                          default:
                            return null;
                        }
                      }
                      case 'tool-get_emails':
                      case 'tool-getEmails': {
                        switch (part.state) {
                          case 'input-available':
                          case 'input-streaming':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <Spinner className="size-4" /> Retrieving emails...
                              </div>
                            );
                          case 'output-error':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <X className="size-4" /> Error retrieving emails
                              </div>
                            );
                          case 'output-available': {
                            const output = part.output;
                            const foundCount =
                              typeof output === 'object' &&
                              output !== null &&
                              'count' in output
                                ? Number(output.count) || 0
                                : 0;
                            const category =
                              typeof output === 'object' && output !== null && 'category' in output
                                ? String(output.category)
                                : undefined;
                            // @ts-expect-error
                            const results = Array.isArray(output?.data)
                              ? // @ts-expect-error
                                output.data
                              : [];

                            return (
                              <ExpandableEmails
                                category={category}
                                foundCount={foundCount}
                                key={`${message.id}-${part.type}-${index}`}
                                results={results}
                              />
                            );
                          }
                          default:
                            return null;
                        }
                      }
                      case 'tool-get_email_details':
                      case 'tool-get-email-details':
                      case 'tool-getEmailDetails': {
                        switch (part.state) {
                          case 'input-available':
                          case 'input-streaming':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <Spinner className="size-4" /> Retrieving email details...
                              </div>
                            );
                          case 'output-error':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <X className="size-4" /> Error retrieving email details
                              </div>
                            );
                          case 'output-available': {
                            const output = part.output;
                            const emailData =
                              typeof output === 'object' &&
                              output !== null &&
                              'data' in output
                                ? (output as { data: EmailDetailsData }).data
                                : null;

                            if (!emailData) {
                              return (
                                <div
                                  className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                  key={`${message.id}-${part.type}-${index}`}
                                >
                                  <X className="size-4" /> No email details available
                                </div>
                              );
                            }

                            return (
                              <EmailDetails
                                email={emailData}
                                key={`${message.id}-${part.type}-${index}`}
                              />
                            );
                          }
                          default:
                            return null;
                        }
                      }
                      case 'tool-send_email':
                      case 'tool-sendEmail': {
                        switch (part.state) {
                          case 'input-available':
                          case 'input-streaming':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <Spinner className="size-4" /> Sending email...
                              </div>
                            );
                          case 'output-error':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <X className="size-4" /> Error sending email
                              </div>
                            );
                          case 'output-available': {
                            const output = part.output;
                            const input = part.input;
                            const emailData =
                              typeof output === 'object' &&
                              output !== null &&
                              'data' in output
                                ? (output as { data: { id?: string; threadId?: string; message?: string; labelIds?: string[] } }).data
                                : null;
                            const inputData =
                              typeof input === 'object' && input !== null
                                ? (input as { to?: string; subject?: string; body?: string })
                                : null;

                            if (!emailData || !emailData.message) {
                              return (
                                <div
                                  className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                  key={`${message.id}-${part.type}-${index}`}
                                >
                                  <X className="size-4" /> Email send status unknown
                                </div>
                              );
                            }

                            return (
                              <div
                                className="text-sm bg-accent/50 rounded-md border border-border bg-white p-3"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <div className="flex items-center gap-2 text-gray-900 mb-2">
                                  <Check className="size-4 text-green-600" />
                                  <span className="font-medium">{emailData.message}</span>
                                </div>
                                {inputData && (
                                  <div className="ml-6 space-y-1 text-xs text-gray-900">
                                    {inputData.to && (
                                      <div>
                                        <span className="font-medium text-gray-900">To:</span>{' '}
                                        {inputData.to}
                                      </div>
                                    )}
                                    {inputData.subject && (
                                      <div>
                                        <span className="font-medium text-gray-900">Subject:</span>{' '}
                                        {inputData.subject}
                                      </div>
                                    )}
                                    {emailData.id && (
                                      <div className="text-xs text-gray-900 mt-1">
                                        Email ID: {emailData.id}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          default:
                            return null;
                        }
                      }
                      case 'tool-set_calendar_event':
                      case 'tool-setCalendarEvent': {
                        switch (part.state) {
                          case 'input-available':
                          case 'input-streaming':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <Spinner className="size-4" /> Creating calendar event...
                              </div>
                            );
                          case 'output-error':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <X className="size-4" /> Error creating calendar event
                              </div>
                            );
                          case 'output-available': {
                            const output = part.output;
                            const input = part.input;
                            const eventData =
                              typeof output === 'object' && output !== null
                                ? (output as { status?: string; summary?: string; htmlLink?: string })
                                : null;
                            const inputData =
                              typeof input === 'object' && input !== null
                                ? (input as {
                                    summary?: string;
                                    start?: { dateTime?: string; timeZone?: string };
                                    end?: { dateTime?: string; timeZone?: string };
                                    location?: string;
                                    description?: string;
                                    attendees?: string[];
                                  })
                                : null;

                            const formatDateTime = (dateTime?: string, timeZone?: string) => {
                              if (!dateTime) return '';
                              try {
                                const date = new Date(dateTime);
                                return date.toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  timeZone: timeZone || 'UTC',
                                });
                              } catch {
                                return dateTime;
                              }
                            };

                            return (
                              <div
                                className="text-sm bg-accent/50 rounded-md border border-border bg-white p-3"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <div className="flex items-center gap-2 text-gray-900 mb-2">
                                  <Check className="size-4 text-green-600" />
                                  <span className="font-medium">
                                    {eventData?.summary || inputData?.summary || 'Calendar event created'}
                                  </span>
                                </div>
                                {inputData && (
                                  <div className="ml-6 space-y-1.5 text-xs text-gray-900">
                                    {inputData.start && (
                                      <div className="flex items-start gap-2">
                                        <Clock className="size-3.5 mt-0.5 flex-shrink-0 text-blue-600" />
                                        <div>
                                          <div className="font-medium">Start:</div>
                                          <div className="text-muted-foreground">
                                            {formatDateTime(inputData.start.dateTime, inputData.start.timeZone)}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {inputData.end && (
                                      <div className="flex items-start gap-2">
                                        <Clock className="size-3.5 mt-0.5 flex-shrink-0 text-blue-600" />
                                        <div>
                                          <div className="font-medium">End:</div>
                                          <div className="text-muted-foreground">
                                            {formatDateTime(inputData.end.dateTime, inputData.end.timeZone)}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {inputData.location && (
                                      <div>
                                        <span className="font-medium">Location:</span> {inputData.location}
                                      </div>
                                    )}
                                    {inputData.attendees && inputData.attendees.length > 0 && (
                                      <div>
                                        <span className="font-medium">Attendees:</span>{' '}
                                        {inputData.attendees.join(', ')}
                                      </div>
                                    )}
                                    {eventData?.htmlLink && (
                                      <a
                                        className="text-blue-600 hover:underline flex items-center gap-1 mt-2"
                                        href={eventData.htmlLink}
                                        rel="noopener noreferrer"
                                        target="_blank"
                                      >
                                        <Calendar className="size-3.5" />
                                        View in Google Calendar
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          default:
                            return null;
                        }
                      }
                      case 'tool-get_calendar_events':
                      case 'tool-getCalendarEvents': {
                        switch (part.state) {
                          case 'input-available':
                          case 'input-streaming':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <Spinner className="size-4" /> Fetching calendar events...
                              </div>
                            );
                          case 'output-error':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <X className="size-4" /> Error fetching calendar events
                              </div>
                            );
                          case 'output-available': {
                            const output = part.output;
                            const events =
                              typeof output === 'object' &&
                              output !== null &&
                              'events' in output &&
                              Array.isArray((output as { events: any[] }).events)
                                ? (output as { events: any[] }).events
                                : [];

                            if (events.length === 0) {
                              return (
                                <div className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900">
                                  <Check className="size-4" /> No calendar events found
                                </div>
                              );
                            }

                            return (
                              <div className="text-sm bg-accent/50 rounded-md border border-border bg-white p-3">
                                <div className="flex items-center gap-2 text-gray-900 mb-2">
                                  <Calendar className="size-4 text-blue-600" />
                                  <span className="font-medium">{events.length} event{events.length !== 1 ? 's' : ''} found</span>
                                </div>
                                <div className="ml-6 space-y-2 max-h-64 overflow-y-auto">
                                  {events.map((event: any, idx: number) => (
                                    <div key={idx} className="text-xs text-gray-900 border-b border-border pb-2 last:border-0 last:pb-0">
                                      {event.summary && (
                                        <div className="font-medium mb-1">{event.summary}</div>
                                      )}
                                      {event.start?.dateTime && (
                                        <div className="text-muted-foreground">
                                          {new Date(event.start.dateTime).toLocaleString()}
                                        </div>
                                      )}
                                      {event.location && (
                                        <div className="text-muted-foreground">📍 {event.location}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          default:
                            return null;
                        }
                      }
                      case 'tool-set_calendar_task':
                      case 'tool-setCalendarTask': {
                        switch (part.state) {
                          case 'input-available':
                          case 'input-streaming':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <Spinner className="size-4" /> Creating task...
                              </div>
                            );
                          case 'output-error':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <X className="size-4" /> Error creating task
                              </div>
                            );
                          case 'output-available': {
                            const output = part.output;
                            const input = part.input;
                            const taskData =
                              typeof output === 'object' && output !== null
                                ? (output as { status?: string; title?: string; id?: string })
                                : null;
                            const inputData =
                              typeof input === 'object' && input !== null
                                ? (input as { title?: string; description?: string; dueDate?: string; category?: string })
                                : null;

                            return (
                              <div
                                className="text-sm bg-accent/50 rounded-md border border-border bg-white p-3"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <div className="flex items-center gap-2 text-gray-900 mb-2">
                                  <Check className="size-4 text-green-600" />
                                  <span className="font-medium">
                                    Task created: {taskData?.title || inputData?.title || 'Task'}
                                  </span>
                                </div>
                                {inputData && (
                                  <div className="ml-6 space-y-1 text-xs text-gray-900">
                                    {inputData.description && (
                                      <div>
                                        <span className="font-medium">Description:</span> {inputData.description}
                                      </div>
                                    )}
                                    {inputData.dueDate && (
                                      <div>
                                        <span className="font-medium">Due:</span>{' '}
                                        {new Date(inputData.dueDate).toLocaleString()}
                                      </div>
                                    )}
                                    {inputData.category && (
                                      <div>
                                        <span className="font-medium">Category:</span> {inputData.category}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          default:
                            return null;
                        }
                      }
                      case 'tool-list_calendar_tasks':
                      case 'tool-listCalendarTasks': {
                        switch (part.state) {
                          case 'input-available':
                          case 'input-streaming':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <Spinner className="size-4" /> Fetching tasks...
                              </div>
                            );
                          case 'output-error':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <X className="size-4" /> Error fetching tasks
                              </div>
                            );
                          case 'output-available': {
                            const output = part.output;
                            const totalCount =
                              typeof output === 'object' &&
                              output !== null &&
                              'totalCount' in output
                                ? Number((output as { totalCount: number }).totalCount) || 0
                                : 0;
                            const tasksData =
                              typeof output === 'object' &&
                              output !== null &&
                              'data' in output &&
                              typeof (output as { data: any }).data === 'object'
                                ? (output as { data: Record<string, any[]> }).data
                                : {};

                            // Flatten tasks from all categories
                            const allTasks: Array<{ category: string; task: any }> = [];
                            Object.entries(tasksData).forEach(([category, tasks]) => {
                              if (Array.isArray(tasks)) {
                                tasks.forEach((task) => {
                                  allTasks.push({ category, task });
                                });
                              }
                            });

                            if (totalCount === 0 || allTasks.length === 0) {
                              return (
                                <div className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900">
                                  <Check className="size-4" /> No tasks found
                                </div>
                              );
                            }

                            return (
                              <div className="text-sm bg-accent/50 rounded-md border border-border bg-white p-3">
                                <div className="flex items-center gap-2 text-gray-900 mb-2">
                                  <Check className="size-4 text-blue-600" />
                                  <span className="font-medium">
                                    {totalCount} task{totalCount !== 1 ? 's' : ''} found
                                  </span>
                                </div>
                                <div className="ml-6 space-y-3 max-h-64 overflow-y-auto">
                                  {Object.entries(tasksData).map(([category, tasks]) => {
                                    if (!Array.isArray(tasks) || tasks.length === 0) return null;
                                    return (
                                      <div key={category} className="space-y-2">
                                        <div className="font-medium text-xs text-gray-700 uppercase tracking-wide">
                                          {category}
                                        </div>
                                        {tasks.map((task: any) => (
                                          <div
                                            key={task.id || task.title}
                                            className="text-xs text-gray-900 border-b border-border pb-2 last:border-0 last:pb-0"
                                          >
                                            <div className="flex items-center gap-2">
                                              {task.status === 'completed' ? (
                                                <Check className="size-3 text-green-600" />
                                              ) : (
                                                <div className="size-3 border border-gray-400 rounded" />
                                              )}
                                              <span
                                                className={
                                                  task.status === 'completed'
                                                    ? 'line-through text-muted-foreground'
                                                    : 'font-medium'
                                                }
                                              >
                                                {task.title}
                                              </span>
                                            </div>
                                            {task.due && (
                                              <div className="ml-5 text-muted-foreground">
                                                Due: {new Date(task.due).toLocaleDateString()}
                                              </div>
                                            )}
                                            {task.notes && (
                                              <div className="ml-5 text-muted-foreground line-clamp-2">
                                                {task.notes}
                                              </div>
                                            )}
                                            {task.link && (
                                              <a
                                                className="ml-5 text-blue-600 hover:underline text-xs"
                                                href={task.link}
                                                rel="noopener noreferrer"
                                                target="_blank"
                                              >
                                                View in Google Tasks
                                              </a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }
                          default:
                            return null;
                        }
                      }
                      case 'tool-fetch_memory':
                      case 'tool-fetchMemory': {
                        switch (part.state) {
                          case 'input-available':
                          case 'input-streaming':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <Spinner className="size-4" /> Fetching memory...
                              </div>
                            );
                          case 'output-error':
                            return (
                              <div
                                className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900"
                                key={`${message.id}-${part.type}-${index}`}
                              >
                                <X className="size-4" /> Error fetching memory
                              </div>
                            );
                          case 'output-available': {
                            const output = part.output;
                            const memoryData =
                              typeof output === 'object' && output !== null
                                ? (output as { title?: string; content?: string; id?: string })
                                : null;

                            if (!memoryData) {
                              return (
                                <div className="text-sm flex items-center gap-2 text-muted-foreground text-gray-900">
                                  <X className="size-4" /> Memory not found
                                </div>
                              );
                            }

                            return (
                              <div className="text-sm bg-accent/50 rounded-md border border-border bg-white p-3">
                                <div className="flex items-center gap-2 text-gray-900 mb-2">
                                  <Check className="size-4 text-green-600" />
                                  <span className="font-medium">Memory retrieved</span>
                                </div>
                                <div className="ml-6 space-y-1 text-xs text-gray-900">
                                  {memoryData.title && (
                                    <div className="font-medium text-sm mb-1">{memoryData.title}</div>
                                  )}
                                  {memoryData.content && (
                                    <div className="text-muted-foreground">{memoryData.content}</div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          default:
                            return null;
                        }
                      }
                      default:
                        return null;
                    }
                  })}
              </div>
              {message.role === 'assistant' && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  <Button
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        message.parts
                          .filter((p) => p.type === 'text')
                          ?.map((p) => (p as any).text)
                          .join('\n') ?? '',
                      );
                      console.log('Copied to clipboard');
                      toast.success('Copied to clipboard');
                    }}
                    size="icon"
                    variant="ghost"
                  >
                    <Copy className="size-3.5 text-gray-900" />
                  </Button>
                  <Button
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => regenerate({ messageId: message.id })}
                    size="icon"
                    variant="ghost"
                  >
                    <RotateCcw className="size-3.5 text-gray-900" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          {status === 'submitted' && (
            <div className="flex text-muted-foreground justify-start gap-2 px-4 py-3 items-center w-full">
              <Spinner className="size-4 text-gray-900" />
              <TextShimmer className="text-sm text-gray-900" duration={1.5}>
                Thinking...
              </TextShimmer>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <Button
          className={cn(
            'rounded-full w-fit mx-auto shadow-md z-10 absolute inset-x-0 bottom-4 flex justify-center',
            'transition-all duration-200 ease-out',
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
          variant="default"
        >
          Scroll to bottom
        </Button>
      </div>

      <div className="px-4 pb-4 pt-1 relative flex-shrink-0">
        <form
          className="flex bg-white flex-col items-end gap-3 border border-border border-slate-900 rounded-[22px] p-3 relative shadow-lg dark:shadow-2xl"
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
            className="w-full text-gray-900 placeholder:text-gray-500 rounded-md outline-none resize-none text-base leading-relaxed px-3 py-3 bg-transparent"
            rows={3}
          />
          <div className="absolute bottom-2 right-2 bg-gray-500 rounded-xl">
            <Button
              type="submit"
              disabled={!input.trim()}
              className="text-primary-foreground rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-primary hover:bg-primary/90"
              size="icon"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
