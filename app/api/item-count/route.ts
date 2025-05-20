import { type NextRequest, NextResponse } from "next/server"
import { kv } from "@/lib/kv"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    // Get all keys to count them
    const postIds = (await kv.get<string[]>("post_ids")) || []

    return NextResponse.json({ count: postIds.length })
  } catch (error) {
    console.error("Error fetching item count:", error)
    return NextResponse.json({ count: 0 }, { status: 500 })
  }
}
