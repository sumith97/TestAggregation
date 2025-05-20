import type { NextRequest } from "next/server"
import { getPostStore, subscribeToPostStore } from "@/lib/post-store"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  // Create a new ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Get post IDs first
        const posts = await getPostStore()

        // Only send the 20 most recent posts to avoid overwhelming the client
        const recentPosts = posts.slice(0, 20)

        // Send recent posts
        recentPosts.forEach((post) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(post)}\n\n`))
          } catch (err) {
            console.error("Error sending post to stream:", err)
          }
        })

        // Subscribe to new posts
        const callback = (post: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(post)}\n\n`))
          } catch (err) {
            console.error("Error sending new post to stream:", err)
          }
        }

        // Add this client to subscribers
        const unsubscribe = subscribeToPostStore(callback)

        // Handle client disconnect
        request.signal.addEventListener("abort", () => {
          unsubscribe()
        })
      } catch (error) {
        console.error("Error in SSE stream:", error)
        controller.close()
      }
    },
  })

  // Return the stream with appropriate headers for SSE
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
