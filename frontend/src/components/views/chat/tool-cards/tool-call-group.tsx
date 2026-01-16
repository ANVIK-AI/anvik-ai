import { cn } from '@lib/utils';
import { Check, ChevronDown, ChevronRight, Loader2, AlertCircle, Wrench } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ToolState } from './tool-card-base';

// Types for tool invocation
export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: 'partial-call' | 'call' | 'result' | 'error';
  result?: unknown;
  error?: string;
}

export interface ToolCallGroupProps {
  /** The step number in the multi-step sequence (1-indexed) */
  stepNumber: number;
  /** Total number of steps completed so far */
  totalSteps?: number;
  /** Tool invocations in this step/group */
  toolInvocations: ToolInvocation[];
  /** Whether this is the current active step */
  isActive?: boolean;
  /** Rendered tool cards for each invocation */
  children: ReactNode;
  /** Custom class name */
  className?: string;
}

// Get overall status of a group of tool invocations
function getGroupStatus(
  invocations: ToolInvocation[],
): 'loading' | 'success' | 'error' | 'partial' {
  if (invocations.length === 0) return 'loading';

  const hasError = invocations.some((t) => t.state === 'error');
  const allComplete = invocations.every((t) => t.state === 'result');
  const hasLoading = invocations.some((t) => t.state === 'call' || t.state === 'partial-call');

  if (hasError) return 'error';
  if (allComplete) return 'success';
  if (hasLoading) return 'loading';
  return 'partial';
}

// Get a human-readable name for the tool
function getToolDisplayName(toolName: string): string {
  const nameMap: Record<string, string> = {
    search_memories: 'Search Memories',
    add_memory: 'Add Memory',
    fetch_memory: 'Fetch Memory',
    get_calendar_events: 'Get Calendar Events',
    set_calendar_event: 'Create Calendar Event',
    set_calendar_task: 'Create Task',
    list_calendar_tasks: 'List Tasks',
    get_emails: 'Get Emails',
    get_email_details: 'Get Email Details',
    send_email: 'Send Email',
  };
  return nameMap[toolName] || toolName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

// Status indicator component
function StepStatusIndicator({ status }: { status: 'loading' | 'success' | 'error' | 'partial' }) {
  switch (status) {
    case 'loading':
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600">
          <Loader2 className="size-3.5 animate-spin" />
        </div>
      );
    case 'success':
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600">
          <Check className="size-3.5" />
        </div>
      );
    case 'error':
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600">
          <AlertCircle className="size-3.5" />
        </div>
      );
    case 'partial':
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600">
          <Wrench className="size-3.5" />
        </div>
      );
  }
}

export function ToolCallGroup({
  stepNumber,
  totalSteps,
  toolInvocations,
  isActive = false,
  children,
  className,
}: ToolCallGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const status = getGroupStatus(toolInvocations);
  const toolCount = toolInvocations.length;

  // Generate summary text
  const toolNames = toolInvocations.map((t) => getToolDisplayName(t.toolName));
  const summaryText =
    toolCount === 1
      ? toolNames[0]
      : `${toolNames.slice(0, 2).join(', ')}${toolCount > 2 ? ` +${toolCount - 2} more` : ''}`;

  const statusText = {
    loading: 'Running',
    success: 'Completed',
    error: 'Failed',
    partial: 'Processing',
  }[status];

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all duration-200',
        status === 'loading' &&
          'border-blue-200 bg-gradient-to-br from-blue-50/50 to-white shadow-sm',
        status === 'success' && 'border-gray-200 bg-white shadow-sm hover:shadow-md',
        status === 'error' && 'border-red-200 bg-gradient-to-br from-red-50/30 to-white shadow-sm',
        status === 'partial' &&
          'border-amber-200 bg-gradient-to-br from-amber-50/30 to-white shadow-sm',
        isActive && 'ring-2 ring-blue-400/30',
        className,
      )}
    >
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50/50 transition-colors"
      >
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <StepStatusIndicator status={status} />
          {totalSteps && totalSteps > 1 && (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              Step {stepNumber}/{totalSteps}
            </span>
          )}
        </div>

        {/* Summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">{summaryText}</span>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                status === 'loading' && 'bg-blue-100 text-blue-700',
                status === 'success' && 'bg-green-100 text-green-700',
                status === 'error' && 'bg-red-100 text-red-700',
                status === 'partial' && 'bg-amber-100 text-amber-700',
              )}
            >
              {statusText}
            </span>
          </div>
          {toolCount > 1 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {toolCount} tool{toolCount > 1 ? 's' : ''} in this step
            </p>
          )}
        </div>

        {/* Expand/collapse indicator */}
        <div className="text-gray-400">
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </div>
      </button>

      {/* Expanded content - tool cards */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

// Helper component for rendering a single step's tools with visual grouping
export function ToolStepContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('space-y-2', className)}>{children}</div>;
}

// Multi-step progress indicator component
export interface MultiStepProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
  className?: string;
}

export function MultiStepProgress({ currentStep, totalSteps, className }: MultiStepProgressProps) {
  if (totalSteps <= 1) return null;

  return (
    <div className={cn('flex items-center gap-1 mb-3', className)}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isComplete = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;

        return (
          <div key={stepNum} className="flex items-center gap-1">
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all',
                isComplete && 'bg-green-500 text-white',
                isCurrent && 'bg-blue-500 text-white ring-2 ring-blue-200',
                !isComplete && !isCurrent && 'bg-gray-200 text-gray-500',
              )}
            >
              {isComplete ? <Check className="size-3" /> : stepNum}
            </div>
            {stepNum < totalSteps && (
              <div
                className={cn(
                  'w-6 h-0.5 transition-all',
                  isComplete ? 'bg-green-500' : 'bg-gray-200',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Export utility function to convert tool invocation state to ToolState
export function invocationStateToToolState(invocation: ToolInvocation): ToolState {
  switch (invocation.state) {
    case 'partial-call':
      return 'input-streaming';
    case 'call':
      return 'input-available';
    case 'result':
      return 'output-available';
    case 'error':
      return 'output-error';
    default:
      return 'input-available';
  }
}
