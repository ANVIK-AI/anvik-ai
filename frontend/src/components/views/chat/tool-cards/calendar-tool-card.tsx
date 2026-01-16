import {
  Calendar,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { ToolCardBase, CalendarSkeleton, EmptyState, type ToolState } from './tool-card-base';

// Types
interface CalendarEvent {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; timeZone?: string; date?: string };
  end?: { dateTime?: string; timeZone?: string; date?: string };
  location?: string;
  description?: string;
  attendees?: string[] | { email?: string }[];
  htmlLink?: string;
  status?: string;
}

interface CreateEventInput {
  summary?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: string;
  description?: string;
  attendees?: string[];
}

// Helper functions
const formatDateTime = (dateTime?: string, timeZone?: string) => {
  if (!dateTime) return '';
  try {
    const date = new Date(dateTime);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timeZone || undefined,
    });
  } catch {
    return dateTime;
  }
};

const formatTime = (dateTime?: string, timeZone?: string) => {
  if (!dateTime) return '';
  try {
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timeZone || undefined,
    });
  } catch {
    return '';
  }
};

const getDayNumber = (dateTime?: string) => {
  if (!dateTime) return '';
  try {
    return new Date(dateTime).getDate().toString();
  } catch {
    return '';
  }
};

const getMonthShort = (dateTime?: string) => {
  if (!dateTime) return '';
  try {
    return new Date(dateTime).toLocaleDateString('en-US', { month: 'short' });
  } catch {
    return '';
  }
};

// Get Calendar Events Card Component
interface GetCalendarEventsCardProps {
  state: ToolState;
  output?: {
    events?: CalendarEvent[];
  };
  onRetry?: () => void;
}

export function GetCalendarEventsCard({ state, output, onRetry }: GetCalendarEventsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isLoading = state === 'input-available' || state === 'input-streaming';
  const isError = state === 'output-error';
  const isSuccess = state === 'output-available';

  const events = output?.events ?? [];

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-gradient-to-r from-purple-50/50 to-white overflow-hidden animate-in fade-in duration-300">
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-100 text-purple-600">
            <Calendar className="size-4 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Fetching calendar events</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Checking your schedule...</p>
          </div>
        </div>
        <CalendarSkeleton />
        <CalendarSkeleton />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <ToolCardBase
        state={state}
        icon={<Calendar className="size-4" />}
        loadingText="Fetching events..."
        errorText="Failed to fetch calendar events"
        errorDetails="We couldn't access your calendar. Please check your connection and try again."
        onRetry={onRetry}
      />
    );
  }

  // Success state - No events found
  if (isSuccess && events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden animate-in fade-in duration-300">
        <EmptyState
          icon={<Calendar className="size-5" />}
          title="No events found"
          description="Your calendar is clear for this period"
        />
      </div>
    );
  }

  // Success state - Events found
  if (isSuccess) {
    return (
      <div className="rounded-lg border border-border bg-white overflow-hidden shadow-sm animate-in fade-in duration-300 hover:shadow-md transition-shadow">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-50 text-purple-600 flex-shrink-0">
            <Calendar className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900">
              {events.length} event{events.length !== 1 ? 's' : ''} found
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-xs text-gray-500">{isExpanded ? 'Hide' : 'Show'}</span>
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-border animate-in slide-in-from-top-2 duration-200">
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {events.map((event, index) => (
                <CalendarEventItem key={event.id || index} event={event} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Individual calendar event item
function CalendarEventItem({ event }: { event: CalendarEvent }) {
  const startDateTime = event.start?.dateTime || event.start?.date;
  const endDateTime = event.end?.dateTime || event.end?.date;

  return (
    <div className="p-3 hover:bg-gray-50 transition-colors group">
      <div className="flex items-start gap-3">
        {/* Date badge */}
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-100 to-purple-50 flex flex-col items-center justify-center flex-shrink-0 border border-purple-100">
          <span className="text-xs text-purple-600 font-medium uppercase">
            {getMonthShort(startDateTime)}
          </span>
          <span className="text-lg font-bold text-purple-700 leading-none">
            {getDayNumber(startDateTime)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Event title */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {event.summary || 'Untitled Event'}
            </span>
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ExternalLink className="size-3.5 text-purple-500 hover:text-purple-600" />
              </a>
            )}
          </div>

          {/* Time */}
          <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
            <Clock className="size-3" />
            <span>
              {formatTime(startDateTime, event.start?.timeZone)}
              {endDateTime && ` - ${formatTime(endDateTime, event.end?.timeZone)}`}
            </span>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
              <MapPin className="size-3" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Set Calendar Event Card Component
interface SetCalendarEventCardProps {
  state: ToolState;
  input?: CreateEventInput;
  output?: CalendarEvent;
  onRetry?: () => void;
}

export function SetCalendarEventCard({ state, input, output, onRetry }: SetCalendarEventCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isLoading = state === 'input-available' || state === 'input-streaming';
  const isError = state === 'output-error';
  const isSuccess = state === 'output-available';

  const eventData = output;

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-gradient-to-r from-purple-50/50 to-white overflow-hidden animate-in fade-in duration-300">
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-100 text-purple-600">
            <CalendarPlus className="size-4 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Creating calendar event</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" />
              </div>
            </div>
            {input?.summary && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{input.summary}</p>
            )}
          </div>
        </div>
        <div className="px-3 pb-3">
          <div className="h-2 bg-purple-200 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full animate-pulse w-2/3" />
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
        icon={<CalendarPlus className="size-4" />}
        loadingText="Creating event..."
        errorText="Failed to create calendar event"
        errorDetails="The event could not be created. Please check the details and try again."
        onRetry={onRetry}
      />
    );
  }

  // Success state
  if (isSuccess) {
    const displayData = eventData || input;
    const startDateTime = displayData?.start?.dateTime;

    return (
      <div className="rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-white overflow-hidden shadow-sm animate-in fade-in duration-300">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-green-50/50 transition-colors"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-green-100 text-green-600 flex-shrink-0">
            <Check className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-green-800">
              Event created: {displayData?.summary || 'Calendar event'}
            </span>
          </div>
          <div className="text-gray-400">
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-green-100 p-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-start gap-3">
              {/* Date badge */}
              {startDateTime && (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-100 to-green-50 flex flex-col items-center justify-center flex-shrink-0 border border-green-100">
                  <span className="text-xs text-green-600 font-medium uppercase">
                    {getMonthShort(startDateTime)}
                  </span>
                  <span className="text-lg font-bold text-green-700 leading-none">
                    {getDayNumber(startDateTime)}
                  </span>
                </div>
              )}

              <div className="flex-1 min-w-0 space-y-2 text-sm">
                {/* Time */}
                {displayData?.start && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="size-4 text-green-600" />
                    <span>
                      {formatDateTime(displayData.start.dateTime, displayData.start.timeZone)}
                    </span>
                  </div>
                )}

                {/* Location */}
                {input?.location && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="size-4 text-green-600" />
                    <span>{input.location}</span>
                  </div>
                )}

                {/* Attendees */}
                {input?.attendees && input.attendees.length > 0 && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="size-4 text-green-600" />
                    <span>{input.attendees.join(', ')}</span>
                  </div>
                )}

                {/* Calendar link */}
                {eventData?.htmlLink && (
                  <a
                    href={eventData.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 hover:underline text-sm mt-2"
                  >
                    <Calendar className="size-3.5" />
                    View in Google Calendar
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
