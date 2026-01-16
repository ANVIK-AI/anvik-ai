// import { ChevronsDown } from "lucide-react"
import { ChatInput } from "@/components/chat-input"
// import { BackgroundPlus } from "@ui/components/grid-plus"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/ui/design-system";
import { Loader } from "lucide-react";

export default function Chat() {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-80px)] w-full">
                <div className="flex flex-col items-center gap-5 p-10 glass-panel rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/20 p-3 rounded-full animate-pulse">
                            <Loader className="w-8 h-8 text-primary animate-spin" />
                        </div>
                        <div className="flex flex-col items-start">
                            <div className="text-xl font-bold font-heading">Initializing...</div>
                            <div className="text-sm text-muted-foreground">{user?.email}</div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                <div className="flex flex-col items-center gap-8 p-12 glass-panel rounded-3xl max-w-md text-center">
                    <h1 className="text-5xl font-heading font-bold text-gradient">Galaxies</h1>
                    <p className="text-xl text-muted-foreground">Access Restricted</p>
                    <p className="text-sm text-muted-foreground/80">Please sign in to access your personal workspace.</p>
                    <Button
                        variant="glow"
                        size="lg"
                        className="w-full rounded-full"
                        onClick={() => {
                            window.location.href = "/login"
                        }}
                    >
                        Login
                    </Button>
                </div>
            </div>
        )

    }

    return (
        <div className="container max-w-5xl mx-auto p-4 md:p-6 h-[calc(100vh-80px)] flex flex-col">
            <div className="flex flex-col h-full rounded-2xl overflow-hidden relative glass-card border-white/5 shadow-2xl">
                {/* <BackgroundPlus /> */}
                <div className="p-4 flex-1 flex items-center justify-center relative bg-black/20">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50" />
                    <ChatInput />
                </div>

                {/* <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-2 opacity-75">
                    <ChevronsDown className="size-4" />
                    <p>Scroll down to see memories</p>
                </div> */}
            </div>
        </div>
    )
}
