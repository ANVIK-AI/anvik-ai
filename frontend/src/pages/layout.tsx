// src/layouts/NavigationLayout.tsx
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { GraphDialog } from "@/components/graph-dialog";
import { Header } from "@/components/header";
import { AddMemoryView } from "@/components/views/add-memory";

export default function Layout({ setShowTestPage }: any) {
  const [showAddMemoryView, setShowAddMemoryView] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]');

      if (isInputField) return;

      if (
        event.key === "c" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        setShowAddMemoryView(true);
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  return (
    <div className="relative bg-background text-foreground flex-1 flex flex-col min-h-screen font-sans selection:bg-primary/30">
      {/* Decorative background elements can replace ThreeBackground if needed, or keep it. */}
      {/* <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20 pointer-events-none" /> */}

      {/* Header handled by sticky positioning in Header component or here */}
      <Header
        onAddMemory={() => {
          // setShowAddMemoryView(true);
          setShowTestPage(true);
          navigate("/test");
        }}
      />

      {showAddMemoryView && (
        <AddMemoryView
          initialTab="note"
          onClose={() => setShowAddMemoryView(false)}
        />
      )}

      <GraphDialog />
      <Outlet />
    </div>
  );
}
