// src/layouts/NavigationLayout.tsx
import { useEffect, useState } from "react"
import { Outlet } from "react-router-dom"
import { GraphDialog } from "@/components/graph-dialog"
import { Header } from "@/components/header"
import { AddMemoryView } from "@/components/views/add-memory"

export default function Layout() {
  const [showAddMemoryView, setShowAddMemoryView] = useState(false)

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')

      if (isInputField) return

      if (
        event.key === "c" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault()
        setShowAddMemoryView(true)
      }
    }

    document.addEventListener("keydown", handleKeydown)
    return () => document.removeEventListener("keydown", handleKeydown)
  }, [])

  return (
    <div className="relative min-h-screen">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/10">
        <Header onAddMemory={() => setShowAddMemoryView(true)} />
      </div>


      {showAddMemoryView && (
        <AddMemoryView
        initialTab="note"
        onClose={() => setShowAddMemoryView(false)}
        />
      )}

      <GraphDialog />
      <Outlet />
    </div>
  )
}
