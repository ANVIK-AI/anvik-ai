import { cn } from '@lib/utils';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock,
  ExternalLink,
  ListTodo,
  Plus,
  Tag,
} from 'lucide-react';
import { useState } from 'react';
import { ToolCardBase, TaskSkeleton, EmptyState, type ToolState } from './tool-card-base';

// Types
interface Task {
  id?: string;
  title?: string;
  notes?: string;
  status?: 'needsAction' | 'completed' | string;
  due?: string;
  link?: string;
  parent?: string;
  position?: string;
}

interface CreateTaskInput {
  title?: string;
  description?: string;
  dueDate?: string;
  category?: string;
}

interface CreateTaskOutput {
  status?: string;
  title?: string;
  id?: string;
}

// Helper functions
const formatDueDate = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return dateStr;
  }
};

const isOverdue = (dateStr?: string) => {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  } catch {
    return false;
  }
};

// List Calendar Tasks Card Component
interface ListCalendarTasksCardProps {
  state: ToolState;
  output?: {
    totalCount?: number;
    data?: Record<string, Task[]>;
  };
  onRetry?: () => void;
}

export function ListCalendarTasksCard({ state, output, onRetry }: ListCalendarTasksCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const isLoading = state === 'input-available' || state === 'input-streaming';
  const isError = state === 'output-error';
  const isSuccess = state === 'output-available';

  const totalCount = output?.totalCount ?? 0;
  const tasksData = output?.data ?? {};
  const categories = Object.entries(tasksData).filter(
    ([_, tasks]) => Array.isArray(tasks) && tasks.length > 0,
  );

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-gradient-to-r from-amber-50/50 to-white overflow-hidden animate-in fade-in duration-300">
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-100 text-amber-600">
            <ListTodo className="size-4 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Fetching tasks</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Loading your task lists...</p>
          </div>
        </div>
        <TaskSkeleton />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <ToolCardBase
        state={state}
        icon={<ListTodo className="size-4" />}
        loadingText="Fetching tasks..."
        errorText="Failed to fetch tasks"
        errorDetails="We couldn't access your tasks. Please check your connection and try again."
        onRetry={onRetry}
      />
    );
  }

  // Success state - No tasks found
  if (isSuccess && totalCount === 0) {
    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden animate-in fade-in duration-300">
        <EmptyState
          icon={<ListTodo className="size-5" />}
          title="No tasks found"
          description="Your task list is empty"
        />
      </div>
    );
  }

  // Success state - Tasks found
  if (isSuccess) {
    // Count completed vs pending
    let completedCount = 0;
    let pendingCount = 0;
    categories.forEach(([_, tasks]) => {
      tasks.forEach((task) => {
        if (task.status === 'completed') completedCount++;
        else pendingCount++;
      });
    });

    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden shadow-sm animate-in fade-in duration-300 hover:shadow-md transition-shadow">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex-shrink-0">
            <ListTodo className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900">
              {totalCount} task{totalCount !== 1 ? 's' : ''} found
            </span>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Circle className="size-2.5 text-amber-500" />
                {pendingCount} pending
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <CheckCircle2 className="size-2.5 text-green-500" />
                {completedCount} done
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-xs text-gray-500">{isExpanded ? 'Hide' : 'Show'}</span>
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-border animate-in slide-in-from-top-2 duration-200">
            <div className="max-h-96 overflow-y-auto">
              {categories.map(([category, tasks]) => (
                <div key={category} className="border-b border-gray-100 last:border-0">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center gap-2 p-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <Tag className="size-3.5 text-amber-500" />
                    <span className="text-sm font-medium text-gray-700 flex-1">{category}</span>
                    <span className="text-xs text-gray-400">{tasks.length}</span>
                    {expandedCategories.has(category) ? (
                      <ChevronDown className="size-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="size-4 text-gray-400" />
                    )}
                  </button>

                  {expandedCategories.has(category) && (
                    <div className="bg-gray-50/50 divide-y divide-gray-100">
                      {tasks.map((task, index) => (
                        <TaskItem key={task.id || index} task={task} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Individual task item
function TaskItem({ task }: { task: Task }) {
  const isCompleted = task.status === 'completed';
  const overdue = !isCompleted && isOverdue(task.due);

  return (
    <div className="px-4 py-2.5 hover:bg-white transition-colors group">
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div
          className={cn(
            'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-colors',
            isCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 group-hover:border-amber-400',
          )}
        >
          {isCompleted && <Check className="size-3" />}
        </div>

        <div className="flex-1 min-w-0">
          {/* Task title */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm',
                isCompleted ? 'text-gray-400 line-through' : 'text-gray-900 font-medium',
              )}
            >
              {task.title || 'Untitled task'}
            </span>
            {task.link && (
              <a
                href={task.link}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ExternalLink className="size-3.5 text-amber-500 hover:text-amber-600" />
              </a>
            )}
          </div>

          {/* Due date */}
          {task.due && (
            <div
              className={cn(
                'flex items-center gap-1.5 mt-1 text-xs',
                overdue ? 'text-red-500' : 'text-gray-500',
              )}
            >
              <Clock className="size-3" />
              <span>
                {overdue ? 'Overdue: ' : ''}
                {formatDueDate(task.due)}
              </span>
            </div>
          )}

          {/* Notes */}
          {task.notes && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.notes}</p>}
        </div>
      </div>
    </div>
  );
}

// Set Calendar Task Card Component
interface SetCalendarTaskCardProps {
  state: ToolState;
  input?: CreateTaskInput;
  output?: CreateTaskOutput;
  onRetry?: () => void;
}

export function SetCalendarTaskCard({ state, input, output, onRetry }: SetCalendarTaskCardProps) {
  const isLoading = state === 'input-available' || state === 'input-streaming';
  const isError = state === 'output-error';
  const isSuccess = state === 'output-available';

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-gradient-to-r from-amber-50/50 to-white overflow-hidden animate-in fade-in duration-300">
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-100 text-amber-600">
            <Plus className="size-4 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Creating task</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" />
              </div>
            </div>
            {input?.title && <p className="text-xs text-gray-500 mt-0.5 truncate">{input.title}</p>}
          </div>
        </div>
        <div className="px-3 pb-3">
          <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full animate-pulse w-2/3" />
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
        loadingText="Creating task..."
        errorText="Failed to create task"
        errorDetails="The task could not be created. Please check the details and try again."
        onRetry={onRetry}
      />
    );
  }

  // Success state
  if (isSuccess) {
    const taskTitle = output?.title || input?.title || 'Task';

    return (
      <div className="rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-white overflow-hidden shadow-sm animate-in fade-in duration-300">
        <div className="p-3">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-green-100 text-green-600 flex-shrink-0">
              <Check className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-green-800">Task created: {taskTitle}</span>

              {(input?.description || input?.dueDate || input?.category) && (
                <div className="mt-2 space-y-1.5 text-sm">
                  {input?.description && (
                    <div className="flex items-start gap-2 text-gray-600">
                      <ClipboardList className="size-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{input.description}</span>
                    </div>
                  )}
                  {input?.dueDate && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="size-4 text-green-600" />
                      <span>Due: {formatDueDate(input.dueDate)}</span>
                    </div>
                  )}
                  {input?.category && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Tag className="size-4 text-green-600" />
                      <span>{input.category}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
