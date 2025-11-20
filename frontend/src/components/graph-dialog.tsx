"use client"

import { $fetch } from "@lib/api"
import type { DocumentsWithMemoriesResponseSchema } from "@/validation/api"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { z } from "zod"
import { MemoryGraph } from "@/components/memory-graph"
import { Dialog, DialogContent } from "@ui/dialog"
import { AddMemoryView } from "@/components/views/add-memory"
import { useChatOpen, useProject, useGraphModal } from "@/stores"
import { useGraphHighlights } from "@/stores/highlights"
import { useIsMobile } from "@hooks/use-mobile"

type DocumentsResponse = z.infer<typeof DocumentsWithMemoriesResponseSchema>
type DocumentWithMemories = DocumentsResponse["documents"][0]

export function GraphDialog() {
	const { documentIds: allHighlightDocumentIds } = useGraphHighlights()
	const { selectedProject } = useProject()
	const { isOpen } = useChatOpen()
	const { isOpen: showGraphModal, setIsOpen: setShowGraphModal } =
		useGraphModal()
	const [injectedDocs, setInjectedDocs] = useState<DocumentWithMemories[]>([])
	const [showAddMemoryView, setShowAddMemoryView] = useState(false)
	const isMobile = useIsMobile()

	const IS_DEV = process.env.NODE_ENV === "development"
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
		queryKey: ["documents-with-memories"],
		initialPageParam: 1,
		queryFn: async ({ pageParam }) => {
			const response = await $fetch("@post/documents/documents", {
				credentials: 'include',
				body: {
					page: pageParam as number,
					limit: (pageParam as number) === 1 ? (IS_DEV ? 500 : 500) : PAGE_SIZE,
					sort: "createdAt",
					order: "desc",
					containerTags: undefined,
				},
				disableValidation: true,
			})

			if (response.error) {
				throw new Error(response.error?.message || "Failed to fetch documents")
			}
			console.log("graph data")
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

	// Handle highlighted documents injection for chat
	useEffect(() => {
		if (!isOpen) return
		if (!allHighlightDocumentIds || allHighlightDocumentIds.length === 0) return
		const present = new Set<string>()
		for (const d of [...baseDocuments, ...injectedDocs]) {
			if (d.id) present.add(d.id)
			if (d.customId) present.add(d.customId as string)
		}
		const missing = allHighlightDocumentIds.filter(
			(id: string) => !present.has(id),
		)
		if (missing.length === 0) return
		let cancelled = false
		const run = async () => {
			try {
				const resp = await $fetch("@post/documents/documents/by-ids", {
					credentials: 'include',
					body: {
						ids: missing,
						by: "customId",
						containerTags: selectedProject ? [selectedProject] : undefined,
					},
					disableValidation: true,
				})
				if (cancelled || resp?.error) return
				const extraDocs = resp?.data?.documents as
					| DocumentWithMemories[]
					| undefined
				if (!extraDocs || extraDocs.length === 0) return
				setInjectedDocs((prev) => {
					const seen = new Set<string>([
						...prev.map((d) => d.id),
						...baseDocuments.map((d) => d.id),
					])
					const merged = [...prev]
					for (const doc of extraDocs) {
						if (!seen.has(doc.id)) {
							merged.push(doc)
							seen.add(doc.id)
						}
					}
					return merged
				})
			} catch { }
		}
		void run()
		return () => {
			cancelled = true
		}
	}, [
		isOpen,
		allHighlightDocumentIds,
		baseDocuments,
		injectedDocs,
		selectedProject,
	])

	return (
		<>
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
									<p>connect ai model</p>
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

			{showAddMemoryView && (
				<AddMemoryView
					initialTab="note"
					onClose={() => setShowAddMemoryView(false)}
				/>
			)}
		</>
	)
}