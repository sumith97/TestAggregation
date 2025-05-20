import { type NextRequest, NextResponse } from "next/server"
import { kv } from "@/lib/kv"

export const dynamic = "force-dynamic"

// Default page size
const DEFAULT_PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  try {
    // Get pagination parameters from query string
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const pageSize = Number.parseInt(searchParams.get("pageSize") || DEFAULT_PAGE_SIZE.toString(), 10)

    // Validate and limit page size
    const validPageSize = Math.min(Math.max(1, pageSize), 50) // Between 1 and 50
    const validPage = Math.max(1, page) // At least 1

    // Get all post IDs
    const allPostIds = (await kv.get<string[]>("post_ids")) || []
    const totalPosts = allPostIds.length

    // Calculate pagination
    const startIndex = (validPage - 1) * validPageSize
    const endIndex = Math.min(startIndex + validPageSize, totalPosts)

    // Get the IDs for the current page
    const pagePostIds = allPostIds.slice(startIndex, endIndex)

    if (pagePostIds.length === 0) {
      // No posts on this page
      return NextResponse.json({
        posts: [],
        pagination: {
          page: validPage,
          pageSize: validPageSize,
          totalPosts,
          totalPages: Math.ceil(totalPosts / validPageSize),
          hasMore: false,
        },
      })
    }

    // Fetch posts individually to avoid large batch requests
    const posts = []
    for (const id of pagePostIds) {
      try {
        const post = await kv.get(`post:${id}`)
        if (post) {
          posts.push(post)
        }
      } catch (error) {
        console.error(`Error fetching post ${id}:`, error)
        // Continue with other posts
      }
    }

    // Return paginated results
    return NextResponse.json({
      posts,
      pagination: {
        page: validPage,
        pageSize: validPageSize,
        totalPosts,
        totalPages: Math.ceil(totalPosts / validPageSize),
        hasMore: endIndex < totalPosts,
      },
    })
  } catch (error) {
    console.error("Error fetching posts:", error)
    return NextResponse.json({ error: "Failed to fetch posts", posts: [] }, { status: 500 })
  }
}
