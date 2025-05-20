import { type NextRequest, NextResponse } from "next/server"
import { clearAllPosts } from "@/lib/post-store"

export const dynamic = "force-dynamic"

// This is an admin endpoint to clear all posts
// In a production app, you would add authentication
export async function POST(request: NextRequest) {
  try {
    await clearAllPosts()
    return NextResponse.json({ success: true, message: "All posts cleared" })
  } catch (error) {
    console.error("Error clearing posts:", error)
    return NextResponse.json({ success: false, message: "Failed to clear posts" }, { status: 500 })
  }
}
