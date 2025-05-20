"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { DbUsageIndicator } from "@/components/db-usage-indicator"
import { DbUsageIndicatorFallback } from "@/components/db-usage-indicator-fallback"

interface PostData {
  id: string
  timestamp: string
  content: any
}

interface PaginationData {
  page: number
  pageSize: number
  totalPosts: number
  totalPages: number
  hasMore: boolean
}

export default function Home() {
  const [posts, setPosts] = useState<PostData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [postToDelete, setPostToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [connectionError, setConnectionError] = useState(false)
  const [dbStatsError, setDbStatsError] = useState(false)
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 20,
    totalPosts: 0,
    totalPages: 1,
    hasMore: false,
  })

  // Fetch posts with pagination
  const fetchPosts = async (page = 1, pageSize = 20) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/posts?page=${page}&pageSize=${pageSize}`)
      if (!response.ok) {
        throw new Error("Failed to fetch posts")
      }
      const data = await response.json()
      setPosts(data.posts || [])
      setPagination(
        data.pagination || {
          page,
          pageSize,
          totalPosts: data.posts?.length || 0,
          totalPages: 1,
          hasMore: false,
        },
      )
      setConnectionError(false)
    } catch (err) {
      console.error("Error fetching posts:", err)
      setConnectionError(true)
      // Try SSE as fallback
      connectToEventSource()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Check if the DB stats component has an error
    const checkDbStats = async () => {
      try {
        const response = await fetch("/api/db-stats")
        if (!response.ok) {
          setDbStatsError(true)
        }
      } catch (err) {
        setDbStatsError(true)
      }
    }

    checkDbStats()

    // Fetch posts with pagination
    fetchPosts(1)
  }, [])

  const connectToEventSource = () => {
    // Connect to the SSE endpoint
    const eventSource = new EventSource("/api/events")

    eventSource.onopen = () => {
      setLoading(false)
      setConnectionError(false)
    }

    eventSource.onmessage = (event) => {
      try {
        const newPost = JSON.parse(event.data)
        setPosts((prevPosts) => {
          // Check if we already have this post (to avoid duplicates)
          if (prevPosts.some((p) => p.id === newPost.id)) {
            return prevPosts
          }
          return [newPost, ...prevPosts]
        })
      } catch (err) {
        console.error("Error parsing event data:", err)
      }
    }

    eventSource.onerror = () => {
      setLoading(false)
      setConnectionError(true)
      eventSource.close()
    }

    // Clean up the connection when component unmounts
    return () => {
      eventSource.close()
    }
  }

  // Get content type label and icon with improved styling
  const getContentTypeDisplay = (content: any) => {
    try {
      if (!content || typeof content !== "object") {
        return (
          <div className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs font-medium">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Unknown
          </div>
        )
      }

      if (content.type === "html") {
        return (
          <div className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
            HTML
          </div>
        )
      } else if (content.type === "zip-archive") {
        return (
          <div className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs font-medium">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            ZIP Archive
          </div>
        )
      } else if (content.type === "text") {
        return (
          <div className="inline-flex items-center px-2 py-1 bg-gray-50 text-gray-700 border border-gray-200 rounded text-xs font-medium">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Text
          </div>
        )
      } else {
        return (
          <div className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            JSON
          </div>
        )
      }
    } catch (err) {
      console.error("Error rendering content type:", err)
      return (
        <div className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 border border-red-200 rounded text-xs font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          Error
        </div>
      )
    }
  }

  // Get content summary with improved naming
  const getContentSummary = (content: any) => {
    try {
      if (!content) return "Unknown Content"

      if (content.type === "html" && content.metadata) {
        // For HTML content, use a more descriptive format
        const title = content.metadata.title || "Untitled Document"
        const description = content.metadata.description
          ? content.metadata.description.length > 60
            ? content.metadata.description.substring(0, 60) + "..."
            : content.metadata.description
          : ""

        return (
          <div>
            <div className="font-medium">{title}</div>
            {description && <div className="text-xs text-gray-500 mt-1">{description}</div>}
          </div>
        )
      } else if (content.type === "zip-archive") {
        // For ZIP archives, show more details about the content
        const filename = content.metadata?.filename || "ZIP Archive"
        const fileCount = content.files?.length || 0
        const htmlCount = content.metadata?.htmlFiles?.length || 0

        return (
          <div>
            <div className="font-medium">{filename}</div>
            <div className="text-xs text-gray-500 mt-1">
              {fileCount} files ({htmlCount} HTML) • Main: {content.mainFile.split("/").pop()}
            </div>
          </div>
        )
      } else if (typeof content === "object") {
        // For JSON, try to find a title-like field or return a summary
        const keys = Object.keys(content)

        // Look for common title fields
        for (const titleField of ["title", "name", "heading", "subject", "label"]) {
          if (keys.includes(titleField) && typeof content[titleField] === "string") {
            const title = content[titleField]
            // Find a potential description field
            let description = ""
            for (const descField of ["description", "summary", "text", "content", "body"]) {
              if (keys.includes(descField) && typeof content[descField] === "string") {
                description =
                  content[descField].length > 60 ? content[descField].substring(0, 60) + "..." : content[descField]
                break
              }
            }

            return (
              <div>
                <div className="font-medium">{title}</div>
                {description && <div className="text-xs text-gray-500 mt-1">{description}</div>}
              </div>
            )
          }
        }

        // If no title field found, show a preview of the structure
        const keyPreview = keys.slice(0, 3).join(", ") + (keys.length > 3 ? "..." : "")
        return (
          <div>
            <div className="font-medium">JSON Object</div>
            <div className="text-xs text-gray-500 mt-1">
              {keys.length} properties: {keyPreview}
            </div>
          </div>
        )
      }
      return "Content"
    } catch (err) {
      console.error("Error getting content summary:", err)
      return "Error displaying content"
    }
  }

  // Handle delete button click
  const handleDeleteClick = (id: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setPostToDelete(id)
    setDeleteDialogOpen(true)
  }

  // Handle confirm delete
  const handleConfirmDelete = async () => {
    if (!postToDelete) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/content/${postToDelete}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete content")
      }

      // Update local state
      setPosts((prevPosts) => prevPosts.filter((post) => post.id !== postToDelete))

      // Update pagination
      setPagination((prev) => ({
        ...prev,
        totalPosts: Math.max(0, prev.totalPosts - 1),
        totalPages: Math.max(1, Math.ceil((prev.totalPosts - 1) / prev.pageSize)),
      }))

      toast({
        title: "Content deleted",
        description: "The content has been successfully deleted.",
      })
    } catch (error) {
      console.error("Error deleting content:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete content. Please try again.",
      })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setPostToDelete(null)
    }
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    fetchPosts(newPage, pagination.pageSize)
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">Content Data Stream</h1>
        </div>
        {dbStatsError ? <DbUsageIndicatorFallback /> : <DbUsageIndicator />}
      </div>

      <p className="mb-6 text-muted-foreground">
        This page displays content received through the API. Send POST requests to{" "}
        <code className="bg-muted px-1 py-0.5 rounded">/api/post</code> with JSON or HTML data.
      </p>
      <div className="mb-6 flex gap-2">
        <Button asChild variant="outline">
          <a href="/upload">Upload Content</a>
        </Button>
        <Button variant="outline" onClick={() => fetchPosts(1)} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Data"}
        </Button>
      </div>
      <p className="mb-6 text-muted-foreground">
        <strong>Data is stored persistently</strong> using Vercel KV (powered by Upstash Redis).
      </p>

      {connectionError && (
        <div className="mb-6 p-4 border border-yellow-300 bg-yellow-50 rounded-md">
          <p className="text-yellow-800">
            <strong>Connection issue:</strong> There was a problem connecting to the event stream. Data may not be
            real-time. Click "Refresh Data" to try again.
          </p>
        </div>
      )}

      <div className="border rounded-md">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">Loading stored data...</div>
        ) : posts.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data received yet. Send a POST request to see data here.
          </div>
        ) : (
          <div className="divide-y">
            {posts.map((post) => (
              <div key={post.id} className="p-4 hover:bg-gray-50 relative">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getContentTypeDisplay(post.content)}
                      <span className="text-sm text-gray-500">{new Date(post.timestamp).toLocaleString()}</span>
                    </div>
                    <Link href={`/content/${post.id}`} className="group">
                      <div className="group-hover:underline">{getContentSummary(post.content)}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400 font-mono">{post.id}</span>
                      </div>
                    </Link>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200"
                    onClick={(e) => handleDeleteClick(post.id, e)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center mt-6 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="ml-1">Previous</span>
          </Button>

          <div className="text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={!pagination.hasMore || loading}
          >
            <span className="mr-1">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {pagination.totalPosts > 0 && (
        <div className="text-center text-sm text-gray-500 mt-2">
          Showing {posts.length} of {pagination.totalPosts} total items
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this content? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </main>
  )
}
