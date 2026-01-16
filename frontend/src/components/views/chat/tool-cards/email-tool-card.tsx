import { Check, ChevronDown, ChevronRight, Mail, Send } from 'lucide-react';
import { useState } from 'react';
import { ToolCardBase, EmailSkeleton, EmptyState, type ToolState } from './tool-card-base';

// Types
interface EmailResult {
  id?: string;
  threadId?: string;
  subject?: string;
  from?: string;
  date?: string;
  snippet?: string;
}

interface EmailDetailsData {
  id?: string;
  threadId?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  snippet?: string;
  body?: string;
}

interface SendEmailResult {
  id?: string;
  threadId?: string;
  message?: string;
  labelIds?: string[];
}

interface SendEmailInput {
  to?: string;
  subject?: string;
  body?: string;
}

// Helper functions
const decodeHtml = (html: string) => {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
};

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

const formatDateFull = (dateStr?: string) => {
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

const extractEmailAddress = (fromStr?: string) => {
  if (!fromStr) return '';
  const match = fromStr.match(/<([^>]+)>/);
  return match ? match[1] : fromStr;
};

const extractName = (emailStr?: string) => {
  if (!emailStr) return '';
  const match = emailStr.match(/^(.+?)\s*<(.+)>$/);
  return match ? match[1].trim().replace(/['"]/g, '') : '';
};

// Email List Card Component
interface GetEmailsCardProps {
  state: ToolState;
  output?: {
    count?: number;
    category?: string;
    data?: EmailResult[];
  };
  onRetry?: () => void;
}

export function GetEmailsCard({ state, output, onRetry }: GetEmailsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isLoading = state === 'input-available' || state === 'input-streaming';
  const isError = state === 'output-error';
  const isSuccess = state === 'output-available';

  const foundCount = output?.count ?? 0;
  const category = output?.category;
  const results = output?.data ?? [];

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-gradient-to-r from-blue-50/50 to-white overflow-hidden animate-in fade-in duration-300">
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-100 text-blue-600">
            <Mail className="size-4 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Retrieving emails</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Searching your inbox...</p>
          </div>
        </div>
        <EmailSkeleton />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <ToolCardBase
        state={state}
        icon={<Mail className="size-4" />}
        loadingText="Retrieving emails..."
        errorText="Failed to retrieve emails"
        errorDetails="We couldn't access your emails. Please check your connection and try again."
        onRetry={onRetry}
      />
    );
  }

  // Success state - No emails found
  if (isSuccess && foundCount === 0) {
    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden animate-in fade-in duration-300">
        <EmptyState
          icon={<Mail className="size-5" />}
          title={`No emails found${category ? ` in ${category}` : ''}`}
          description="Try adjusting your search criteria"
        />
      </div>
    );
  }

  // Success state - Emails found
  if (isSuccess) {
    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden shadow-sm animate-in fade-in duration-300 hover:shadow-md transition-shadow">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">
            <Mail className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900">
              {foundCount} email{foundCount !== 1 ? 's' : ''} found
            </span>
            {category && <span className="text-xs text-gray-500 ml-2">in {category}</span>}
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-xs text-gray-500">{isExpanded ? 'Hide' : 'Show'}</span>
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-border animate-in slide-in-from-top-2 duration-200">
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {results.map((email, index) => (
                <EmailListItem key={email.id || email.threadId || index} email={email} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Individual email list item
function EmailListItem({ email }: { email: EmailResult }) {
  return (
    <div className="p-3 hover:bg-gray-50 transition-colors group">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
          {extractName(email.from)?.[0]?.toUpperCase() ||
            extractEmailAddress(email.from)?.[0]?.toUpperCase() ||
            '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {extractName(email.from) || extractEmailAddress(email.from)}
            </span>
            <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(email.date)}</span>
          </div>
          {email.subject && (
            <p className="text-sm text-gray-700 truncate mt-0.5">{email.subject}</p>
          )}
          {email.snippet && (
            <p className="text-xs text-gray-500 line-clamp-2 mt-1 leading-relaxed">
              {decodeHtml(email.snippet)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Email Details Card Component
interface GetEmailDetailsCardProps {
  state: ToolState;
  output?: {
    data?: EmailDetailsData;
  };
  onRetry?: () => void;
}

export function GetEmailDetailsCard({ state, output, onRetry }: GetEmailDetailsCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isLoading = state === 'input-available' || state === 'input-streaming';
  const isError = state === 'output-error';
  const isSuccess = state === 'output-available';

  const email = output?.data;

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-gradient-to-r from-blue-50/50 to-white overflow-hidden animate-in fade-in duration-300">
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-100 text-blue-600">
            <Mail className="size-4 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Loading email details</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        </div>
        <EmailSkeleton />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <ToolCardBase
        state={state}
        icon={<Mail className="size-4" />}
        loadingText="Loading email..."
        errorText="Failed to load email details"
        errorDetails="We couldn't load the email content. Please try again."
        onRetry={onRetry}
      />
    );
  }

  // No email data
  if (isSuccess && !email) {
    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden animate-in fade-in duration-300">
        <EmptyState
          icon={<Mail className="size-5" />}
          title="Email not found"
          description="This email may have been deleted or moved"
        />
      </div>
    );
  }

  // Success state
  if (isSuccess && email) {
    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden shadow-sm animate-in fade-in duration-300">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">
            <Mail className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900 truncate block">
              {email.subject || 'Email details'}
            </span>
            <span className="text-xs text-gray-500">
              From {extractName(email.from) || extractEmailAddress(email.from)}
            </span>
          </div>
          <div className="text-gray-400">
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-border p-4 animate-in slide-in-from-top-2 duration-200">
            {/* Email header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium flex-shrink-0">
                {extractName(email.from)?.[0]?.toUpperCase() ||
                  extractEmailAddress(email.from)?.[0]?.toUpperCase() ||
                  '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {extractName(email.from) || 'Unknown'}
                  </span>
                  <span className="text-sm text-blue-600">{extractEmailAddress(email.from)}</span>
                </div>
                {email.to && (
                  <p className="text-sm text-gray-500">To: {extractEmailAddress(email.to)}</p>
                )}
                {email.date && (
                  <p className="text-xs text-gray-400 mt-1">{formatDateFull(email.date)}</p>
                )}
              </div>
            </div>

            {/* Email subject */}
            {email.subject && (
              <h3 className="text-base font-semibold text-gray-900 mb-3">{email.subject}</h3>
            )}

            {/* Email body */}
            {email.body && (
              <div
                className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: email.body }}
              />
            )}
            {email.snippet && !email.body && (
              <p className="text-sm text-gray-600 leading-relaxed">{email.snippet}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Send Email Card Component
interface SendEmailCardProps {
  state: ToolState;
  input?: SendEmailInput;
  output?: {
    data?: SendEmailResult;
  };
  onRetry?: () => void;
}

export function SendEmailCard({ state, input, output, onRetry }: SendEmailCardProps) {
  const isLoading = state === 'input-available' || state === 'input-streaming';
  const isError = state === 'output-error';
  const isSuccess = state === 'output-available';

  const emailData = output?.data;

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-gradient-to-r from-green-50/50 to-white overflow-hidden animate-in fade-in duration-300">
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-green-100 text-green-600">
            <Send className="size-4 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Sending email</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" />
              </div>
            </div>
            {input?.to && <p className="text-xs text-gray-500 mt-0.5">To: {input.to}</p>}
          </div>
        </div>
        <div className="px-3 pb-3">
          <div className="h-2 bg-green-200 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full animate-pulse w-2/3" />
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
        icon={<Send className="size-4" />}
        loadingText="Sending email..."
        errorText="Failed to send email"
        errorDetails="The email could not be sent. Please check the recipient address and try again."
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
              <span className="text-sm font-medium text-green-800">
                {emailData?.message || 'Email sent successfully'}
              </span>
            </div>
          </div>

          {input && (
            <div className="mt-3 ml-12 space-y-1.5 text-sm">
              {input.to && (
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="text-gray-500 w-16">To:</span>
                  <span className="font-medium">{input.to}</span>
                </div>
              )}
              {input.subject && (
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="text-gray-500 w-16">Subject:</span>
                  <span>{input.subject}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
