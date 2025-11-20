// import { ChevronsDown } from "lucide-react"
import { ChatInput } from "@/components/chat-input"
// import { BackgroundPlus } from "@ui/components/grid-plus"
import { useAuth } from "@/context/AuthContext"
import { Avatar } from "@/ui/components/avatar";
import { Button } from "@/ui/components/button";
import { Loader } from "lucide-react";
import { Navigate } from "react-router-dom";
export default function Chat() {
    const {isAuthenticated, user, loading} =useAuth();
    
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="flex flex-col items-center gap-5 p-10">
                    <div className="flex items-center gap-2">
                        <Avatar size="lg" />
                        <div className="flex flex-col items-start gap-1">
                            <div className="text-xl font-bold">Loading...</div>
                            <div className="text-sm">{user?.email}</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button className="h-9 w-9 text-xl" disabled variant="ghost">
                            <Loader className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#121212] text-white">
                <div className="flex flex-col items-center gap-5 p-10">
                    <h1 className="text-6xl font-bold">Galaxies</h1>
                    <p className="text-2xl">Unauthorized</p>
                    <Button
                        className="bg-[#0070f3] text-white hover:bg-[#0057e7] px-10 py-3 rounded-full"
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
        <div>
            <div className="flex flex-col h-[80vh] rounded-lg overflow-hidden relative">
                {/* <BackgroundPlus /> */}
                <div className="p-4 flex-1 flex items-center justify-center">
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
