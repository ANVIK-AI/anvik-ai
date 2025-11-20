import { Button } from '@ui/components/button';
import { Logo } from '@ui/assets/Logo';
import { Plus, WaypointsIcon, HistoryIcon, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/tooltip';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useGraphModal, useProject } from '@/stores';
import { usePersistentChat } from '@/stores/chat';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@ui/dialog';
import { ScrollArea } from '@ui/components/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export function Header({ onAddMemory }: { onAddMemory?: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const {user, logout} =useAuth();
  const navigate = useNavigate();

  const router = {
    push: (url: string) => navigate(url),
    back: () => navigate(-1),
  };
  const { setIsOpen: setGraphModalOpen } = useGraphModal();
  const { getCurrentChat, conversations, currentChatId, setCurrentChatId, deleteConversation } =
    usePersistentChat();
  const { selectedProject } = useProject();
  const location = useLocation();
  const pathname = location.pathname;

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const sorted = useMemo(() => {
    return [...conversations].sort((a, b) => (a.lastUpdated < b.lastUpdated ? 1 : -1));
  }, [conversations]);

  useEffect(() => {
    console.log('searchParams', searchParams.get('mcp'));
    const mcpParam = searchParams.get('mcp');
    if (mcpParam === 'manual') {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete('mcp');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [searchParams]);

  function handleNewChat() {
    const newId = crypto.randomUUID();
    setCurrentChatId(newId);
    router.push(`/chat/${newId}`);
    setIsDialogOpen(false);
  }

  function formatRelativeTime(isoString: string): string {
    return formatDistanceToNow(new Date(isoString), { addSuffix: true });
  }

  return (
    <div className="flex items-center justify-between w-full p-3 md:p-4 bg-gray-900 ">
      <div className="flex items-center gap-2 md:gap-3 justify-between w-full">
        <div className="flex items-center gap-1.5 md:gap-2">
          <a
            className="pointer-events-auto"
            href={
              process.env.NODE_ENV === 'development'
                ? 'http://localhost:5173'
                : 'https://app.supermemory.ai'
            }
            rel="noopener noreferrer"
          >
            {getCurrentChat()?.title && pathname.includes('/chat') ? (
              <div className="flex items-center gap-4">
                <Logo className="h-6 block text-foreground" />
                <span className="truncate">{getCurrentChat()?.title}</span>
              </div>
            ) : (
              <p className="text-slate-200 text-2xl font-semibold">
                {/* <LogoFull className="h-8 hidden md:block" />
                                <Logo className="h-8 md:hidden text-foreground" /> */}
                Anvik AI Assistant
              </p>
            )}
          </a>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          <Button variant="secondary" size="sm" onClick={onAddMemory} className="gap-1.5 bg-white">
            <Plus className="h-4 w-4 text-gray-900" />
            <span className="hidden sm:inline text-gray-900">Add Memory</span>
            <span className="hidden md:inline bg-secondary-foreground/10 rounded-md px-2 py-[2px] text-xs">
              c
            </span>
          </Button>
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <HistoryIcon className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Chat History</p>
              </TooltipContent>
            </Tooltip>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader className="pb-4 border-b rounded-t-lg">
                <DialogTitle className="">Conversations</DialogTitle>
                <DialogDescription>
                  Project <span className="font-mono font-medium">{selectedProject}</span>
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-96">
                <div className="flex flex-col gap-1">
                  {sorted.map((c) => {
                    const isActive = c.id === currentChatId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCurrentChatId(c.id);
                          router.push(`/chat/${c.id}`);
                          setIsDialogOpen(false);
                        }}
                        className={cn(
                          'flex items-center justify-between rounded-md px-3 py-2 outline-none w-full text-left',
                          'transition-colors',
                          isActive ? 'bg-primary/10' : 'hover:bg-muted',
                        )}
                        aria-current={isActive ? 'true' : undefined}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-sm font-medium truncate',
                                isActive ? 'text-foreground' : undefined,
                              )}
                            >
                              {c.title || 'Untitled Chat'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last updated {formatRelativeTime(c.lastUpdated)}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(c.id);
                          }}
                          aria-label="Delete conversation"
                        >
                          <Trash2 className="size-4 text-muted-foreground" />
                        </Button>
                      </button>
                    );
                  })}
                  {sorted.length === 0 && (
                    <div className="text-xs text-muted-foreground px-3 py-2">
                      No conversations yet
                    </div>
                  )}
                </div>
              </ScrollArea>
              <Button
                variant="outline"
                size="lg"
                className="w-full border-dashed"
                onClick={handleNewChat}
              >
                <Plus className="size-4 mr-1" /> New Conversation
              </Button>
            </DialogContent>
          </Dialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGraphModalOpen(true)}
                className="bg-white"
              >
                <WaypointsIcon className="h-5 w-5 text-gray-900" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Graph View</p>
            </TooltipContent>
          </Tooltip>

          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="relative inline-flex items-center justify-center rounded-full border  bg-white  text-foreground hover:border-white/10 hover:bg-white/10"
                >
                  <img
                    className="h-8 w-8 rounded-full"
                    src={user?.photo || ''}
                    alt="User Avatar"
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-gray-900 text-white p-2 shadow-xl rounded-xl mt-4 mr-1">
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2">
                    <img
                      className="h-6 w-6 rounded-full"
                      src={user?.photo || ''}
                      alt="User Avatar"
                      // style={{ filter: 'invert(1)' }}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium text-white">{user?.displayName}</span>
                      <span className="text-xs text-gray-400">{user?.email}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full border-dashed bg-black"
                    onClick={logout}
                  >
                    <span className="text-xs text-gray-400">Logout</span>
                  </Button>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
