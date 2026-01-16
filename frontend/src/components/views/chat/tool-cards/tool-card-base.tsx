import { cn } from '@lib/utils';
import { AlertCircle, Check, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Spinner } from '../../../spinner';
import { Button } from '@ui/components/button';

export type ToolState = 'input-available' | 'input-streaming' | 'output-available' | 'output-error';

interface ToolCardBaseProps {
  state: ToolState;
  icon: ReactNode;
  loadingText: string;
  successText?: string;
  errorText?: string;
  errorDetails?: string;
  onRetry?: () => void;
  children?: ReactNode;
  expandable?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

// Animation classes for smooth transitions
const animationClasses = {
  fadeIn: 'animate-in fade-in duration-300',
  slideIn: 'animate-in slide-in-from-left-2 duration-300',
  pulse: 'animate-pulse',
};

export function ToolCardBase({
  state,
  icon,
  loadingText,
  successText = 'Completed',
  errorText = 'An error occurred',
  errorDetails,
  onRetry,
  children,
  expandable = false,
  defaultExpanded = false,
  className,
}: ToolCardBaseProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const isLoading = state === 'input-available' || state === 'input-streaming';
  const isError = state === 'output-error';
  const isSuccess = state === 'output-available';

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border border-border bg-gradient-to-r from-slate-50 to-white',
          animationClasses.fadeIn,
          className,
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600">
          <Spinner className="size-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{loadingText}</span>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
            </div>
          </div>
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div
        className={cn(
          'p-3 rounded-lg border border-red-200 bg-gradient-to-r from-red-50 to-white',
          animationClasses.fadeIn,
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-600 flex-shrink-0">
            <AlertCircle className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-red-700">{errorText}</span>
              {onRetry && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRetry}
                  className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-100"
                >
                  <RotateCcw className="size-3.5 mr-1" />
                  Retry
                </Button>
              )}
            </div>
            {errorDetails && (
              <p className="text-xs text-red-600/80 mt-1 line-clamp-2">{errorDetails}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    // If expandable, show collapsed/expanded view
    if (expandable) {
      return (
        <div
          className={cn(
            'rounded-lg border border-border bg-white overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md',
            animationClasses.fadeIn,
            className,
          )}
        >
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-50 text-green-600 flex-shrink-0">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-900">{successText}</span>
            </div>
            <div className="text-gray-400">
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </div>
          </button>
          {isExpanded && (
            <div className={cn('border-t border-border', animationClasses.slideIn)}>{children}</div>
          )}
        </div>
      );
    }

    // Non-expandable success card
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-white overflow-hidden shadow-sm',
          animationClasses.fadeIn,
          className,
        )}
      >
        <div className="flex items-start gap-3 p-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-50 text-green-600 flex-shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900">{successText}</span>
            {children}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Loading skeleton component for tool cards
function LoadingSkeleton() {
  return (
    <div className="mt-2 space-y-2">
      <div className="h-3 bg-gray-200 rounded-full animate-pulse w-3/4" />
      <div className="h-3 bg-gray-200 rounded-full animate-pulse w-1/2" />
    </div>
  );
}

// Reusable skeleton variants for different tool types
export function EmailSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-5/6" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-4/6" />
      </div>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3" />
        </div>
      </div>
    </div>
  );
}

export function TaskSkeleton() {
  return (
    <div className="p-3 space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
          <div className="flex-1 h-4 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function MemorySkeleton() {
  return (
    <div className="p-3">
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-2 rounded-lg border border-gray-100 space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
            <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Status badge component
export function StatusBadge({
  status,
  className,
}: {
  status: 'success' | 'error' | 'pending' | 'in-progress';
  className?: string;
}) {
  const statusConfig = {
    success: { bg: 'bg-green-100', text: 'text-green-700', label: 'Success' },
    error: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
    'in-progress': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
  };

  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        config.bg,
        config.text,
        className,
      )}
    >
      {status === 'success' && <Check className="size-3 mr-1" />}
      {status === 'in-progress' && <Spinner className="size-3 mr-1" />}
      {config.label}
    </span>
  );
}

// Empty state component
export function EmptyState({
  icon,
  title,
  description,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-6 text-center', className)}>
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
        {icon}
      </div>
      <h4 className="text-sm font-medium text-gray-900">{title}</h4>
      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
  );
}
