import { type NextRequest, NextResponse } from "next/server"
import { kv } from "@/lib/kv"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    // Get the post from KV store
    const post = await kv.get(`post:${id}`)

    if (!post) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    return NextResponse.json(post)
  } catch (error) {
    console.error("Error fetching content:", error)
    return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    // Check if post exists
    const post = await kv.get(`post:${id}`)
    if (!post) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    // Delete the post
    await kv.del(`post:${id}`)

    // Update the list of post IDs
    const postIds = (await kv.get<string[]>("post_ids")) || []
    const updatedPostIds = postIds.filter((postId) => postId !== id)
    await kv.set("post_ids", updatedPostIds)

    return NextResponse.json({ success: true, message: "Content deleted successfully" })
  } catch (error) {
    console.error("Error deleting content:", error)
    return NextResponse.json({ error: "Failed to delete content" }, { status: 500 })
  }
}
