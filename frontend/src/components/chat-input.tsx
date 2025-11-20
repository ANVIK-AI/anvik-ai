import { useState, useEffect } from "react"
import { generateId } from "@lib/generate-id"
import { usePersistentChat } from "@/stores/chat"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"


export function ChatInput() {
	const {user} =useAuth()
	const navigate = useNavigate()
	const [message, setMessage] = useState("")
	const [selectedModel, setSelectedModel] = useState<
		"gpt-5" | "claude-sonnet-4.5" | "gemini-2.5-pro"
	>("gemini-2.5-pro")
	const { setCurrentChatId } = usePersistentChat()

	useEffect(() => {
		const savedModel = localStorage.getItem("selectedModel") as
			| "gpt-5"
			| "claude-sonnet-4.5"
			| "gemini-2.5-pro"
		if (
			savedModel &&
			["gpt-5", "claude-sonnet-4.5", "gemini-2.5-pro"].includes(savedModel)
		) {
			setSelectedModel(savedModel)
		}
	}, [])

	const handleSend = () => {
		if (!message.trim()) return

		const newChatId = generateId()

		setCurrentChatId(newChatId)

		sessionStorage.setItem(`chat-initial-${newChatId}`, message.trim())
		sessionStorage.setItem(`chat-model-${newChatId}`, selectedModel)

		navigate(`/chat/${newChatId}`)

		setMessage("")
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			handleSend()
		}
	}

	return (
		<div className="flex-1 flex items-center justify-center px-4">
			<div className="w-full max-w-4xl">
				<div className="text-start mb-4">
					<h2 className="text-3xl font-bold text-foreground text-slate-900">
						Welcome, <span className="text-primary">{user?.displayName}</span>
					</h2>
				</div>
				<div className="relative">
					<form
						className="flex flex-col items-end bg-white border border-border border-slate-900 rounded-[14px] shadow-lg"
						onSubmit={(e) => {
							e.preventDefault()
							if (!message.trim()) return
							handleSend()
						}}
					>
						<textarea
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Ask your supermemory..."
							className="w-full text-foreground placeholder-slate-700 rounded-md outline-none resize-none text-base text-slate-900 leading-relaxed px-6 py-4 bg-transparent"
							rows={2}
						/>
					</form>
				</div>
			</div>
		</div>
	)
}
