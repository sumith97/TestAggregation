import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { addPost } from "@/lib/post-store"
import { parseHtml } from "@/lib/html-parser"
import JSZip from "jszip"

export const dynamic = "force-dynamic"

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const zipFile = formData.get("zipFile") as File

    if (!zipFile || !zipFile.name.endsWith(".zip")) {
      return NextResponse.json({ success: false, message: "Invalid or missing ZIP file" }, { status: 400 })
    }

    if (zipFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: `ZIP file too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 },
      )
    }

    // Read the ZIP file
    const zipBuffer = await zipFile.arrayBuffer()
    const zip = new JSZip()
    const zipContents = await zip.loadAsync(zipBuffer)

    // Extract files from the ZIP
    const files: Record<string, string | ArrayBuffer> = {}
    const fileTypes: Record<string, string> = {}
    const htmlFiles: string[] = []

    // Process all files in the ZIP
    for (const [path, zipEntry] of Object.entries(zipContents.files)) {
      // Skip directories
      if (zipEntry.dir) continue

      // Get the file content
      const content = await zipEntry.async("arraybuffer")

      // Store the file content
      files[path] = content

      // Determine file type
      if (path.endsWith(".html") || path.endsWith(".htm")) {
        htmlFiles.push(path)
        fileTypes[path] = "text/html"
      } else if (path.endsWith(".css")) {
        fileTypes[path] = "text/css"
      } else if (path.endsWith(".js")) {
        fileTypes[path] = "text/javascript"
      } else if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
        fileTypes[path] = "image/jpeg"
      } else if (path.endsWith(".png")) {
        fileTypes[path] = "image/png"
      } else if (path.endsWith(".gif")) {
        fileTypes[path] = "image/gif"
      } else if (path.endsWith(".svg")) {
        fileTypes[path] = "image/svg+xml"
      } else {
        fileTypes[path] = "application/octet-stream"
      }
    }

    // If no HTML files found, return an error
    if (htmlFiles.length === 0) {
      return NextResponse.json({ success: false, message: "No HTML files found in the ZIP archive" }, { status: 400 })
    }

    // Find the main HTML file (index.html or first HTML file)
    const mainHtmlFile =
      htmlFiles.find(
        (file) => file.endsWith("/index.html") || file.endsWith("\\index.html") || file === "index.html",
      ) || htmlFiles[0]

    // Convert the main HTML file content to text
    const mainHtmlContent = new TextDecoder().decode(files[mainHtmlFile] as ArrayBuffer)

    // Parse the HTML content
    const parsedHtml = parseHtml(mainHtmlContent)

    // Create a record of all files in the ZIP
    const zipData = {
      type: "zip-archive",
      mainFile: mainHtmlFile,
      files: Object.keys(files).map((path) => ({
        path,
        type: fileTypes[path],
        size: (files[path] as ArrayBuffer).byteLength,
      })),
      // Store file contents as base64 strings
      fileContents: Object.fromEntries(
        Object.entries(files).map(([path, content]) => [
          path,
          {
            type: fileTypes[path],
            content: Buffer.from(content as ArrayBuffer).toString("base64"),
          },
        ]),
      ),
      html: parsedHtml,
      metadata: {
        filename: zipFile.name,
        size: zipFile.size,
        fileCount: Object.keys(files).length,
        htmlFiles: htmlFiles,
      },
    }

    // Create a new post with ID and timestamp
    const post = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      content: zipData,
    }

    // Add the post to KV store
    await addPost(post)

    return NextResponse.json({
      success: true,
      message: "ZIP file processed and stored",
      postId: post.id,
      contentType: "zip-archive",
      fileCount: Object.keys(files).length,
      htmlFiles: htmlFiles,
      mainFile: mainHtmlFile,
    })
  } catch (error) {
    console.error("Error processing ZIP file:", error)
    return NextResponse.json({ success: false, message: "Failed to process ZIP file" }, { status: 400 })
  }
}
