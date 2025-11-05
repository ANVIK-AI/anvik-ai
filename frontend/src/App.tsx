import './App.css'
import { MemoryGraph } from "./components/memory-graph"
import { Dialog, DialogContent } from "./ui/dialog"
import { useChatOpen, useGraphModal } from "./stores"
import { useCallback, useMemo, useState } from 'react'
import type { DocumentWithMemories } from './lib/types'
import type { DocumentsWithMemoriesResponseSchema } from './validation/api'
import { useInfiniteQuery } from "@tanstack/react-query"
import { $fetch } from "./lib/api"
import { z } from 'zod'
import { useGraphHighlights } from "./stores/highlights"
import { useIsMobile } from './hooks/use-mobile'
import { DocumentRoutesTester } from './pages/document-routes-tester'
import { ChatTester } from './pages/chatTester'
import { BrowserRouter, Route, Routes } from "react-router-dom"
import Layout from './pages/layout'
import Home from './pages/Home'
import { ChatMessages } from './components/views/chat/chat-messages'



type DocumentsResponse = z.infer<typeof DocumentsWithMemoriesResponseSchema>


function App() {

  const [injectedDocs, setInjectedDocs] = useState<DocumentWithMemories[]>([])
  const { documentIds: allHighlightDocumentIds } = useGraphHighlights()
  const { isOpen } = useChatOpen()
  const isMobile = useIsMobile()
  const [showAddMemoryView, setShowAddMemoryView] = useState(false)
  const [showTestPage, setShowTestPage] = useState(false)
  const [showChatPage, setShowChatPage] = useState(false)



  const { isOpen: showGraphModal, setIsOpen: setShowGraphModal } =
    useGraphModal()

  const IS_DEV = "development"
  const PAGE_SIZE = IS_DEV ? 100 : 100
  const MAX_TOTAL = 1000

  const {
    data,
    error,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery<DocumentsResponse, Error>({
    queryKey: ["documents-with-memories"], // add selectedProject in the array Removed selectedProject since we're not filtering for testing
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await $fetch("@post/documents/documents", {
        body: {
          page: pageParam as number,
          limit: (pageParam as number) === 1 ? (IS_DEV ? 500 : 500) : PAGE_SIZE,
          sort: "createdAt",
          order: "desc",
          // Temporarily disable container filtering to see all data
          containerTags: undefined, // selectedProject ? [selectedProject] : undefined, for testing
        },
        disableValidation: true,
      })

      if (response.error) {
        throw new Error(response.error?.message || "Failed to fetch documents")
      }
      console.log("response")
      console.log(response)
      return response.data
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce(
        (acc, p) => acc + (p.documents?.length ?? 0),
        0,
      )
      if (loaded >= MAX_TOTAL) return undefined

      const { currentPage, totalPages } = lastPage.pagination
      if (currentPage < totalPages) {
        return currentPage + 1
      }
      return undefined
    },
    staleTime: 5 * 60 * 1000,
    enabled: true,
  })

  const baseDocuments = useMemo(() => {
    return (
      data?.pages.flatMap((p: DocumentsResponse) => p.documents ?? []) ?? []
    )
  }, [data])

  const allDocuments = useMemo(() => {
    if (injectedDocs.length === 0) return baseDocuments
    const byId = new Map<string, DocumentWithMemories>()
    for (const d of injectedDocs) byId.set(d.id, d)
    for (const d of baseDocuments) if (!byId.has(d.id)) byId.set(d.id, d)
    return Array.from(byId.values())
  }, [baseDocuments, injectedDocs])


  const totalLoaded = allDocuments.length
  const hasMore = hasNextPage
  const isLoadingMore = isFetchingNextPage

  const loadMoreDocuments = useCallback(async (): Promise<void> => {
    if (hasNextPage && !isFetchingNextPage) {
      await fetchNextPage()
      return
    }
    return
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className='bg-[#090B0E]'>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/chat" element={<TestPage showTestPage={showTestPage} setShowTestPage={setShowTestPage} showChatPage={showChatPage} setShowChatPage={setShowChatPage}
              showGraphModal={showGraphModal} setShowGraphModal={setShowGraphModal} allDocuments={allDocuments} error={error} hasMore={hasMore} isPending={isPending} isLoadingMore={isLoadingMore} loadMoreDocuments={loadMoreDocuments} totalLoaded={totalLoaded} allHighlightDocumentIds={allHighlightDocumentIds} isOpen={isOpen}
              isMobile={isMobile} setShowAddMemoryView={setShowAddMemoryView} />} />
            <Route path="/chat/:id" element={<ChatMessages />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  )
}

const TestPage = ({ showTestPage, setShowTestPage, showChatPage, setShowChatPage, showGraphModal, setShowGraphModal
  , allDocuments, error, hasMore, isPending, isLoadingMore, loadMoreDocuments, totalLoaded, allHighlightDocumentIds, isOpen
  , isMobile, setShowAddMemoryView
}: any) => {

  return (
    <div>
      {showTestPage ? (
        <div className="relative">
          <button
            onClick={() => setShowTestPage(false)}
            className="absolute top-4 left-4 z-50 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Main App
          </button>
          <DocumentRoutesTester />
        </div>
      ) :
        showChatPage ? (
          <div className="relative">
            <button
              onClick={() => setShowChatPage(false)}
              className="absolute top-4 left-4 z-50 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              ← Back to Main App
            </button>
            <ChatTester />
          </div>
        ) :
          (
            <div>
              <button
                onClick={() => setShowTestPage(true)}
                className="fixed top-20 right-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Test Document Routes
              </button>
              <button
                onClick={() => setShowChatPage(true)}
                className="fixed top-40 right-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Test chat Routes
              </button>
              <Home />
              <Dialog open={showGraphModal} onOpenChange={setShowGraphModal}>
                <DialogContent
                  className="w-[95vw] h-[95vh] p-0  max-w-6xl sm:max-w-6xl"
                  showCloseButton={true}
                >
                  <div className="w-full h-full">
                    <MemoryGraph
                      documents={allDocuments}
                      error={error}
                      hasMore={hasMore}
                      isLoading={isPending}
                      isLoadingMore={isLoadingMore}
                      loadMoreDocuments={loadMoreDocuments}
                      totalLoaded={totalLoaded}
                      variant="console"
                      showSpacesSelector={true}
                      highlightDocumentIds={allHighlightDocumentIds}
                      highlightsVisible={isOpen}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        {!isMobile ? (
                          <div>
                            connect ai modal
                          </div>
                        ) : (
                          <div className="rounded-xl overflow-hidden cursor-pointer hover:bg-white/5 transition-colors p-6">
                            <div className="relative z-10 text-slate-200 text-center">
                              <div className="flex flex-col gap-3">
                                <button
                                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors underline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowAddMemoryView(true)
                                  }}
                                  type="button"
                                >
                                  Add your first memory
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </MemoryGraph>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}


    </div>
  )
}

export default App
