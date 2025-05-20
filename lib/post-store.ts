import { kv } from "./kv"
import { v4 as uuidv4 } from "uuid"

// Post type definition
export type Post = {
  id: string
  timestamp: string
  content: any
}

// Store subscribers
type Subscriber = (post: Post) => void
const subscribers = new Set<Subscriber>()

// Key for storing the list of post IDs
const POST_IDS_KEY = "post_ids"
// Prefix for individual post keys
const POST_KEY_PREFIX = "post:"
// Maximum posts to keep (for free tier management)
const MAX_POSTS = 500

/**
 * Add a post to KV store and notify subscribers
 */
export async function addPost(post: Post): Promise<void> {
  const postId = post.id || uuidv4()

  // If post doesn't have an ID, assign one
  if (!post.id) {
    post.id = postId
  }

  // Store the post in KV
  const postKey = `${POST_KEY_PREFIX}${postId}`
  await kv.set(postKey, post)

  // Get current list of post IDs
  const postIds = (await kv.get<string[]>(POST_IDS_KEY)) || []

  // Add new post ID to the beginning of the list
  const updatedPostIds = [postId, ...postIds]

  // If we have too many posts, remove the oldest ones
  // This helps stay within the free tier limits
  if (updatedPostIds.length > MAX_POSTS) {
    const idsToRemove = updatedPostIds.slice(MAX_POSTS)
    const keysToRemove = idsToRemove.map((id) => `${POST_KEY_PREFIX}${id}`)

    // Remove old posts
    if (keysToRemove.length > 0) {
      await kv.del(...keysToRemove)
    }

    // Trim the list of IDs
    updatedPostIds.splice(MAX_POSTS)
  }

  // Update the list of post IDs
  await kv.set(POST_IDS_KEY, updatedPostIds)

  // Notify all subscribers
  subscribers.forEach((callback) => {
    callback(post)
  })
}

/**
 * Get all posts from KV store
 */
export async function getPostStore(): Promise<Post[]> {
  // Get the list of post IDs
  const postIds = (await kv.get<string[]>(POST_IDS_KEY)) || []

  if (postIds.length === 0) {
    return []
  }

  // Get all posts in parallel
  const postKeys = postIds.map((id) => `${POST_KEY_PREFIX}${id}`)
  const posts = await kv.mget<Post[]>(...postKeys)

  // Filter out any null values (in case a post was deleted)
  return posts.filter(Boolean) as Post[]
}

/**
 * Subscribe to new posts
 */
export function subscribeToPostStore(callback: Subscriber) {
  subscribers.add(callback)

  // Return unsubscribe function
  return () => {
    subscribers.delete(callback)
  }
}

/**
 * Clear all posts (for testing/admin purposes)
 */
export async function clearAllPosts(): Promise<void> {
  const postIds = (await kv.get<string[]>(POST_IDS_KEY)) || []

  if (postIds.length > 0) {
    const postKeys = postIds.map((id) => `${POST_KEY_PREFIX}${id}`)
    await kv.del(...postKeys)
  }

  await kv.del(POST_IDS_KEY)
}
