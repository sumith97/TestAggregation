import { type NextRequest, NextResponse } from "next/server"
import { kv } from "@/lib/kv"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    // Get all post IDs
    const postIds = (await kv.get<string[]>("post_ids")) || []

    // If there are no posts, return zero usage
    if (postIds.length === 0) {
      return NextResponse.json({
        totalKeys: 0,
        maxStorage: 256 * 1024 * 1024, // 256MB in bytes
        usedStorage: 0,
        usedPercentage: 0,
      })
    }

    // For performance reasons and to avoid request size limits,
    // calculate based on a small sample and extrapolate
    const MAX_SAMPLE_SIZE = 10 // Use a very small sample to avoid hitting limits
    let usedStorage = 0

    // Take a random sample of post IDs
    const sampleIds = postIds.length <= MAX_SAMPLE_SIZE ? postIds : getRandomSample(postIds, MAX_SAMPLE_SIZE)

    // Calculate total size of sample
    let sampleTotalSize = 0
    let validSampleCount = 0

    // Process each sample post individually to avoid large mget requests
    for (const id of sampleIds) {
      try {
        const post = await kv.get(`post:${id}`)
        if (post) {
          validSampleCount++
          // Calculate size by converting to JSON string
          const postSize = JSON.stringify(post).length
          sampleTotalSize += postSize
        }
      } catch (error) {
        console.error(`Error processing post ${id}:`, error)
        // Continue with other samples
      }
    }

    // Calculate average post size and extrapolate
    if (validSampleCount > 0) {
      const averagePostSize = sampleTotalSize / validSampleCount
      usedStorage = averagePostSize * postIds.length
    } else {
      // If no valid samples, use a conservative estimate
      usedStorage = postIds.length * 5000 // Assume 5KB per post
    }

    // Add size of the post_ids key itself
    usedStorage += JSON.stringify(postIds).length

    // Add overhead for Redis metadata (keys, data structures, etc.)
    // This is an approximation - Redis typically has some overhead per key
    const estimatedOverhead = postIds.length * 50 // ~50 bytes overhead per key
    usedStorage += estimatedOverhead

    // Free tier typically has 256MB limit for Vercel KV
    const maxStorage = 256 * 1024 * 1024 // 256MB in bytes

    // Calculate percentage used (with a maximum of 100%)
    const usedPercentage = Math.min(100, Math.round((usedStorage / maxStorage) * 100))

    return NextResponse.json({
      totalKeys: postIds.length,
      maxStorage: maxStorage,
      usedStorage: usedStorage,
      usedPercentage: usedPercentage,
      isSample: postIds.length > MAX_SAMPLE_SIZE,
      sampleSize: validSampleCount,
    })
  } catch (error) {
    console.error("Error calculating database stats:", error)
    return NextResponse.json(
      {
        error: "Failed to calculate database statistics",
        totalKeys: 0,
        maxStorage: 256 * 1024 * 1024,
        usedStorage: 0,
        usedPercentage: 0,
      },
      { status: 500 },
    )
  }
}

// Helper function to get a random sample from an array
function getRandomSample<T>(array: T[], sampleSize: number): T[] {
  if (array.length <= sampleSize) return array

  const sample: T[] = []
  const arrayCopy = [...array]

  for (let i = 0; i < sampleSize; i++) {
    const randomIndex = Math.floor(Math.random() * arrayCopy.length)
    sample.push(arrayCopy[randomIndex])
    arrayCopy.splice(randomIndex, 1)
  }

  return sample
}
