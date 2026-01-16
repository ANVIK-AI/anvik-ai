import { Button } from '@/ui/design-system';
import { Logo } from '@/ui/assets/Logo';
import { Plus, WaypointsIcon, HistoryIcon, Trash2, LogOut } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/components/tooltip'; // Keeping original tooltip for now if compatible
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
} from '@/ui/dialog';
import { ScrollArea } from '@/ui/components/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export function Header({ onAddMemory }: { onAddMemory?: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();
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
    <header className="flex items-center justify-between w-full px-6 py-4 glass sticky top-0 z-50 transition-all duration-300">
      <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-6">
          <a
            className="flex items-center gap-3 group"
            href={
              process.env.NODE_ENV === 'development'
                ? 'http://localhost:5173'
                : 'https://app.supermemory.ai'
            }
            rel="noopener noreferrer"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Logo className="h-8 w-8 relative z-10 text-primary group-hover:scale-110 transition-transform duration-300" />
            </div>

            {getCurrentChat()?.title && pathname.includes('/chat') ? (
              <span className="text-sm font-medium text-muted-foreground truncate max-w-[200px] hidden md:block border-l border-white/10 pl-3 ml-1">
                {getCurrentChat()?.title}
              </span>
            ) : (
              <span className="text-xl font-heading font-bold text-gradient bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">
                Anvik AI
              </span>
            )}
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="glass"
            size="sm"
            onClick={onAddMemory}
            className="gap-2 hidden sm:flex group hover:bg-white/10"
          >
            <Plus className="h-4 w-4 text-purple-400 group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-medium">Add Memory</span>
          </Button>

          <Button
            variant="glass"
            size="icon"
            onClick={onAddMemory}
            className="sm:hidden"
          >
            <Plus className="h-4 w-4 text-purple-400" />
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
                  <Button variant="ghost" size="icon" className="hover:bg-white/5 text-muted-foreground hover:text-white transition-colors">
                    <HistoryIcon className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="dark bg-black/90 backdrop-blur border-white/10 text-xs">
                <p>Chat History</p>
              </TooltipContent>
            </Tooltip>

            <DialogContent className="sm:max-w-lg glass-card border-white/10 bg-black/40 text-foreground backdrop-blur-xl">
              <DialogHeader className="pb-4 border-b border-white/10">
                <DialogTitle className="text-xl font-heading">Conversations</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Project <span className="font-mono text-primary">{selectedProject}</span>
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="flex flex-col gap-2 mt-2">
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
                          'group flex items-center justify-between rounded-xl px-4 py-3 outline-none w-full text-left',
                          'transition-all duration-200 border border-transparent',
                          isActive
                            ? 'bg-primary/10 border-primary/20 shadow-[0_0_15px_rgba(124,58,237,0.1)]'
                            : 'hover:bg-white/5 hover:border-white/5'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-sm font-medium truncate transition-colors',
                                isActive ? 'text-primary' : 'text-foreground group-hover:text-white',
                              )}
                            >
                              {c.title || 'Untitled Chat'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 mt-1">
                            {formatRelativeTime(c.lastUpdated)}
                          </div>
                        </div>
                        <div
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg text-muted-foreground hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(c.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </div>
                      </button>
                    );
                  })}
                  {sorted.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No conversations yet</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="mt-4 pt-4 border-t border-white/10">
                <Button
                  variant="glow"
                  size="lg"
                  className="w-full font-medium"
                  onClick={handleNewChat}
                >
                  <Plus className="size-4 mr-2" /> New Conversation
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setGraphModalOpen(true)}
                className="hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
              >
                <WaypointsIcon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="dark bg-black/90 backdrop-blur border-white/10 text-xs">
              <p>Graph View</p>
            </TooltipContent>
          </Tooltip>

          <div className="ml-2 pl-2 border-l border-white/10">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="relative group w-9 h-9 flex items-center justify-center rounded-full ring-2 ring-transparent hover:ring-primary/50 transition-all overflow-hidden"
                >
                  {user?.photo ? (
                    <img
                      className="h-full w-full object-cover"
                      src={user?.photo}
                      alt="User Avatar"
                    />
                  ) : (
                    <div className="h-full w-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {user?.displayName?.[0] || 'U'}
                    </div>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-black/90 backdrop-blur-xl border border-white/10 p-0 overflow-hidden shadow-2xl rounded-xl mr-2">
                <div className="p-4 border-b border-white/5 bg-gradient-to-br from-secondary/50 to-transparent">
                  <div className="flex items-center gap-3">
                    {user?.photo ? (
                      <img
                        className="h-10 w-10 rounded-full ring-2 ring-white/10"
                        src={user?.photo}
                        alt="User"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {user?.displayName?.[0] || 'U'}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium text-white">{user?.displayName}</span>
                      <span className="text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                  </div>
                </div>
                <div className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-muted-foreground hover:text-red-400 hover:bg-red-500/10 gap-2"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </header>
  );
}
