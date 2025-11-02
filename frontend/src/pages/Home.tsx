import { ChevronsDown } from "lucide-react"
import { ChatInput } from "@/components/chat-input"
import { BackgroundPlus } from "@ui/components/grid-plus"

export default function Home() {

    return (
        <div>
            <div className="flex flex-col h-[80vh] rounded-lg overflow-hidden relative">
                <BackgroundPlus />
                <div className="p-4 flex-1 flex items-center justify-center">
                    <ChatInput />
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-2 opacity-75">
                    <ChevronsDown className="size-4" />
                    <p>Scroll down to see memories</p>
                </div>
            </div>
        </div>
    )
}
