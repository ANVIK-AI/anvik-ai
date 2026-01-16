import { cn } from '@lib/utils';
import {
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Link2,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { ToolCardBase, MemorySkeleton, EmptyState, type ToolState } from './tool-card-base';

// Types
interface MemoryResult {
  documentId?: string;
  title?: string;
  content?: string;
  url?: string;
  score?: number;
}

interface FetchMemoryResult {
  id?: string;
  title?: string;
  content?: string;
}

// Helper function for score display
const getScoreColor = (score?: number) => {
  if (!score) return 'text-gray-400';
  if (score >= 0.8) return 'text-green-600';
  if (score >= 0.6) return 'text-amber-600';
  return 'text-gray-500';
};

const getScoreBgColor = (score?: number) => {
  if (!score) return 'bg-gray-100';
  if (score >= 0.8) return 'bg-green-50';
  if (score >= 0.6) return 'bg-amber-50';
  return 'bg-gray-50';
};

// Search Memories Card Component
interface SearchMemoriesCardProps {
  state: ToolState;
  output?: {
    count?: number;
    results?: MemoryResult[];
  };
  onRetry?: () => void;
}

export function SearchMemoriesCard({ state, output, onRetry }: SearchMemoriesCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isLoading = state === 'input-available' || state === 'input-streaming';
  const isError = state === 'output-error';
  const isSuccess = state === 'output-available';

  const foundCount = output?.count ?? 0;
  const results = output?.results ?? [];

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-gradient-to-r from-indigo-50/50 to-white overflow-hidden animate-in fade-in duration-300">
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 text-indigo-600">
            <Brain className="size-4 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Searching memories</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Finding relevant information...</p>
          </div>
        </div>
        <MemorySkeleton />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <ToolCardBase
        state={state}
        icon={<Brain className="size-4" />}
        loadingText="Searching memories..."
        errorText="Failed to search memories"
        errorDetails="We couldn't access your memories. Please try again."
        onRetry={onRetry}
      />
    );
  }

  // Success state - No memories found
  if (isSuccess && foundCount === 0) {
    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden animate-in fade-in duration-300">
        <EmptyState
          icon={<Brain className="size-5" />}
          title="No related memories found"
          description="Try a different search or add new memories"
        />
      </div>
    );
  }

  // Success state - Memories found
  if (isSuccess) {
    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden shadow-sm animate-in fade-in duration-300 hover:shadow-md transition-shadow">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex-shrink-0">
            <Brain className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900">
              {foundCount} related memor{foundCount !== 1 ? 'ies' : 'y'} found
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-xs text-gray-500">{isExpanded ? 'Hide' : 'Show'}</span>
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-border p-3 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {results.map((result, index) => (
                <MemoryResultItem key={result.documentId || index} result={result} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Individual memory result item
function MemoryResultItem({ result }: { result: MemoryResult }) {
  const isClickable =
    result.url && (result.url.startsWith('http://') || result.url.startsWith('https://'));
  const score = result.score;

  const content = (
    <div className="h-full">
      {/* Score badge */}
      {score !== undefined && (
        <div className="flex items-center gap-1 mb-2">
          <Sparkles className={cn('size-3', getScoreColor(score))} />
          <span className={cn('text-xs font-medium', getScoreColor(score))}>
            {(score * 100).toFixed(0)}% match
          </span>
        </div>
      )}

      {/* Title */}
      {result.title && (
        <h4 className="text-sm font-medium text-gray-900 line-clamp-1 mb-1">{result.title}</h4>
      )}

      {/* Content */}
      {result.content && (
        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{result.content}</p>
      )}

      {/* URL indicator */}
      {result.url && (
        <div className="flex items-center gap-1 mt-2 text-indigo-600">
          <Link2 className="size-3" />
          <span className="text-xs truncate">{new URL(result.url).hostname}</span>
        </div>
      )}
    </div>
  );

  if (isClickable) {
    return (
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'block p-3 rounded-lg border transition-all hover:shadow-md cursor-pointer group',
          getScoreBgColor(score),
          'border-gray-200 hover:border-indigo-300',
        )}
      >
        {content}
        <div className="flex items-center gap-1 mt-2 text-xs text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="size-3" />
          <span>Open link</span>
        </div>
      </a>
    );
  }

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-all',
        getScoreBgColor(score),
        'border-gray-200',
      )}
    >
      {content}
    </div>
  );
}

// Add Memory Card Component
interface AddMemoryCardProps {
  state: ToolState;
  input?: {
    title?: string;
    content?: string;
  };
  output?: any;
  onRetry?: () => void;
}

export function AddMemoryCard({ state, input, onRetry }: AddMemoryCardProps) {
  const isLoading = state === 'input-available' || state === 'input-streaming';
  const isError = state === 'output-error';
  const isSuccess = state === 'output-available';

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-gradient-to-r from-indigo-50/50 to-white overflow-hidden animate-in fade-in duration-300">
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 text-indigo-600">
            <Plus className="size-4 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Adding memory</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
              </div>
            </div>
            {input?.title && <p className="text-xs text-gray-500 mt-0.5 truncate">{input.title}</p>}
          </div>
        </div>
        <div className="px-3 pb-3">
          <div className="h-2 bg-indigo-200 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <ToolCardBase
        state={state}
        icon={<Plus className="size-4" />}
        loadingText="Adding memory..."
        errorText="Failed to add memory"
        errorDetails="The memory could not be saved. Please try again."
        onRetry={onRetry}
      />
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-white overflow-hidden shadow-sm animate-in fade-in duration-300">
        <div className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-green-100 text-green-600 flex-shrink-0">
              <Check className="size-4" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium text-green-800">Memory saved successfully</span>
              {input?.title && <p className="text-xs text-gray-600 mt-0.5">{input.title}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Fetch Memory Card Component
interface FetchMemoryCardProps {
  state: ToolState;
  output?: FetchMemoryResult;
  onRetry?: () => void;
}

export function FetchMemoryCard({ state, output, onRetry }: FetchMemoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isLoading = state === 'input-available' || state === 'input-streaming';
  const isError = state === 'output-error';
  const isSuccess = state === 'output-available';

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-gradient-to-r from-indigo-50/50 to-white overflow-hidden animate-in fade-in duration-300">
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 text-indigo-600">
            <FileText className="size-4 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Fetching memory</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        </div>
        <MemorySkeleton />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <ToolCardBase
        state={state}
        icon={<FileText className="size-4" />}
        loadingText="Fetching memory..."
        errorText="Failed to fetch memory"
        errorDetails="The memory could not be retrieved. It may have been deleted."
        onRetry={onRetry}
      />
    );
  }

  // No memory data
  if (isSuccess && !output) {
    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden animate-in fade-in duration-300">
        <EmptyState
          icon={<Brain className="size-5" />}
          title="Memory not found"
          description="This memory may have been deleted"
        />
      </div>
    );
  }

  // Success state
  if (isSuccess && output) {
    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden shadow-sm animate-in fade-in duration-300">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex-shrink-0">
            <Brain className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900">
              {output.title || 'Memory retrieved'}
            </span>
          </div>
          <div className="text-gray-400">
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </div>
        </button>

        {isExpanded && output.content && (
          <div className="border-t border-border p-4 animate-in slide-in-from-top-2 duration-200">
            <div className="prose prose-sm max-w-none text-gray-700">{output.content}</div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
