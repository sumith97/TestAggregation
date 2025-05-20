import { type NextRequest, NextResponse } from "next/server"
import { kv } from "@/lib/kv"
import JSZip from "jszip"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    // Get the post from KV store
    const post = await kv.get(`post:${id}`)

    if (!post) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    // Check if this is a ZIP archive
    if (post.content?.type !== "zip-archive") {
      return NextResponse.json({ error: "Content is not a ZIP archive" }, { status: 400 })
    }

    // Create a new ZIP file
    const zip = new JSZip()

    // Add all files from the stored content
    const fileContents = post.content.fileContents
    for (const [path, fileData] of Object.entries(fileContents)) {
      // Convert base64 content to binary
      const content = Buffer.from(fileData.content, "base64")
      zip.file(path, content)
    }

    // Generate the ZIP file
    const zipContent = await zip.generateAsync({ type: "nodebuffer" })

    // Get the original filename or use a default
    const filename = post.content.metadata?.filename || `download-${id}.zip`

    // Return the ZIP file as a download
    return new Response(zipContent, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Error generating ZIP download:", error)
    return NextResponse.json({ error: "Failed to generate ZIP download" }, { status: 500 })
  }
}
