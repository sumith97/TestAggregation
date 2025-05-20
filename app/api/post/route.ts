import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { addPost } from "@/lib/post-store"
import { isHtml, parseHtml } from "@/lib/html-parser"
import JSZip from "jszip"

export const dynamic = "force-dynamic"

// Maximum file size for ZIP files (10MB)
const MAX_ZIP_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    let content
    const contentType = request.headers.get("content-type") || ""

    console.log("API Request Content-Type:", contentType)

    // Handle different content types
    if (contentType.includes("application/json")) {
      // Parse JSON body
      content = await request.json()
    } else if (contentType.includes("text/html") || contentType.includes("application/x-www-form-urlencoded")) {
      // Get text content
      const text = await request.text()

      // Check if it's HTML
      if (isHtml(text)) {
        // Parse HTML content
        content = parseHtml(text)
      } else {
        // Try to parse as JSON
        try {
          content = JSON.parse(text)
        } catch (e) {
          // If not JSON, treat as plain text
          content = { type: "text", content: text }
        }
      }
    } else if (contentType.includes("multipart/form-data")) {
      // Handle form data with potential file uploads
      const formData = await request.formData()
      console.log("Form data keys:", Array.from(formData.keys()))

      // Check for any file in the form data
      let file: File | null = null
      let fileFieldName = ""

      // Look for file fields with various common names
      for (const fieldName of ["file", "zipFile", "html", "zip", "archive", "upload"]) {
        const fieldValue = formData.get(fieldName)
        if (fieldValue instanceof File) {
          file = fieldValue
          fileFieldName = fieldName
          break
        }
      }

      // If no file found with common names, check all fields
      if (!file) {
        for (const [fieldName, fieldValue] of formData.entries()) {
          if (fieldValue instanceof File) {
            file = fieldValue
            fileFieldName = fieldName
            break
          }
        }
      }

      if (file) {
        console.log(`Found file in field '${fileFieldName}':`, file.name, file.type, file.size)

        // Check if it's a ZIP file by extension or mime type
        const isZipFile =
          file.name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed"

        if (isZipFile) {
          console.log("Processing as ZIP file")
          // Process ZIP file
          if (file.size > MAX_ZIP_FILE_SIZE) {
            return NextResponse.json(
              {
                success: false,
                message: `ZIP file too large. Maximum size is ${MAX_ZIP_FILE_SIZE / (1024 * 1024)}MB`,
              },
              { status: 400 },
            )
          }

          try {
            // Read the ZIP file
            const zipBuffer = await file.arrayBuffer()

            // Verify this is actually a ZIP file by checking the magic number
            const headerView = new Uint8Array(zipBuffer.slice(0, 4))
            const isPKZip =
              headerView[0] === 0x50 &&
              headerView[1] === 0x4b &&
              (headerView[2] === 0x03 || headerView[2] === 0x05 || headerView[2] === 0x07) &&
              (headerView[3] === 0x04 || headerView[3] === 0x06 || headerView[3] === 0x08)

            if (!isPKZip) {
              console.log("Not a valid ZIP file (wrong magic number)")
              return NextResponse.json(
                { success: false, message: "The uploaded file is not a valid ZIP archive" },
                { status: 400 },
              )
            }

            const zip = new JSZip()
            const zipContents = await zip.loadAsync(zipBuffer)

            // Extract files from the ZIP
            const files: Record<string, string | ArrayBuffer> = {}
            const fileTypes: Record<string, string> = {}
            const htmlFiles: string[] = []
            const jsFiles: string[] = []
            const cssFiles: string[] = []

            // Process all files in the ZIP
            for (const [path, zipEntry] of Object.entries(zipContents.files)) {
              // Skip directories
              if (zipEntry.dir) continue

              try {
                // Get the file content
                const content = await zipEntry.async("arraybuffer")

                // Store the file content
                files[path] = content

                // Determine file type
                if (path.endsWith(".html") || path.endsWith(".htm")) {
                  htmlFiles.push(path)
                  fileTypes[path] = "text/html"
                } else if (path.endsWith(".css")) {
                  cssFiles.push(path)
                  fileTypes[path] = "text/css"
                } else if (path.endsWith(".js")) {
                  jsFiles.push(path)
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
              } catch (error) {
                console.error(`Error processing ZIP file entry ${path}:`, error)
                // Skip this file but continue processing others
              }
            }

            // If no HTML files found, return an error
            if (htmlFiles.length === 0) {
              console.log("No HTML files found in ZIP")
              return NextResponse.json(
                { success: false, message: "No HTML files found in the ZIP archive" },
                { status: 400 },
              )
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
            content = {
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
                filename: file.name,
                size: file.size,
                fileCount: Object.keys(files).length,
                htmlFiles: htmlFiles,
                jsFiles: jsFiles,
                cssFiles: cssFiles,
              },
            }

            console.log("Successfully processed ZIP with", htmlFiles.length, "HTML files")
          } catch (error) {
            console.error("Error processing ZIP file:", error)
            return NextResponse.json({ success: false, message: "Failed to process ZIP file" }, { status: 400 })
          }
        } else {
          // Handle as regular file
          console.log("Processing as regular file")
          const fileContent = await file.text()

          // Check if it's HTML
          if (isHtml(fileContent)) {
            content = parseHtml(fileContent)
          } else {
            // Try to parse as JSON
            try {
              content = JSON.parse(fileContent)
            } catch (e) {
              // If not JSON, treat as plain text
              content = { type: "text", content: fileContent }
            }
          }
        }
      } else {
        // No file found, try to get JSON data from the form
        console.log("No file found in form data")
        const jsonData = formData.get("json")
        if (jsonData) {
          if (typeof jsonData === "string") {
            content = JSON.parse(jsonData)
          } else {
            content = { error: "Unsupported form data format" }
          }
        } else {
          // Convert form data to object
          const formDataObj: Record<string, any> = {}
          formData.forEach((value, key) => {
            formDataObj[key] = value
          })
          content = formDataObj
        }
      }
    } else if (contentType.includes("application/zip") || contentType.includes("application/x-zip-compressed")) {
      // Direct ZIP file upload (not in multipart form)
      console.log("Processing direct ZIP upload")

      // Get the raw binary data
      const zipBuffer = await request.arrayBuffer()

      // Verify this is actually a ZIP file by checking the magic number
      const headerView = new Uint8Array(zipBuffer.slice(0, 4))
      const isPKZip =
        headerView[0] === 0x50 &&
        headerView[1] === 0x4b &&
        (headerView[2] === 0x03 || headerView[2] === 0x05 || headerView[2] === 0x07) &&
        (headerView[3] === 0x04 || headerView[3] === 0x06 || headerView[3] === 0x08)

      if (!isPKZip) {
        console.log("Not a valid ZIP file (wrong magic number)")
        return NextResponse.json(
          { success: false, message: "The uploaded file is not a valid ZIP archive" },
          { status: 400 },
        )
      }

      if (zipBuffer.byteLength > MAX_ZIP_FILE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            message: `ZIP file too large. Maximum size is ${MAX_ZIP_FILE_SIZE / (1024 * 1024)}MB`,
          },
          { status: 400 },
        )
      }

      try {
        const zip = new JSZip()
        const zipContents = await zip.loadAsync(zipBuffer)

        // Extract files from the ZIP
        const files: Record<string, string | ArrayBuffer> = {}
        const fileTypes: Record<string, string> = {}
        const htmlFiles: string[] = []
        const jsFiles: string[] = []
        const cssFiles: string[] = []

        // Process all files in the ZIP
        for (const [path, zipEntry] of Object.entries(zipContents.files)) {
          // Skip directories
          if (zipEntry.dir) continue

          try {
            // Get the file content
            const content = await zipEntry.async("arraybuffer")

            // Store the file content
            files[path] = content

            // Determine file type
            if (path.endsWith(".html") || path.endsWith(".htm")) {
              htmlFiles.push(path)
              fileTypes[path] = "text/html"
            } else if (path.endsWith(".css")) {
              cssFiles.push(path)
              fileTypes[path] = "text/css"
            } else if (path.endsWith(".js")) {
              jsFiles.push(path)
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
          } catch (error) {
            console.error(`Error processing ZIP file entry ${path}:`, error)
            // Skip this file but continue processing others
          }
        }

        // If no HTML files found, return an error
        if (htmlFiles.length === 0) {
          console.log("No HTML files found in ZIP")
          return NextResponse.json(
            { success: false, message: "No HTML files found in the ZIP archive" },
            { status: 400 },
          )
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
        content = {
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
            filename: "uploaded.zip", // No filename available for direct uploads
            size: zipBuffer.byteLength,
            fileCount: Object.keys(files).length,
            htmlFiles: htmlFiles,
            jsFiles: jsFiles,
            cssFiles: cssFiles,
          },
        }

        console.log("Successfully processed direct ZIP upload with", htmlFiles.length, "HTML files")
      } catch (error) {
        console.error("Error processing direct ZIP upload:", error)
        return NextResponse.json({ success: false, message: "Failed to process ZIP file" }, { status: 400 })
      }
    } else if (contentType.includes("application/octet-stream")) {
      // Binary data - could be a ZIP file
      console.log("Processing octet-stream data")

      // Get the raw binary data
      const binaryData = await request.arrayBuffer()

      // Check if it's a ZIP file by looking at the magic number
      const headerView = new Uint8Array(binaryData.slice(0, 4))
      const isPKZip =
        headerView[0] === 0x50 &&
        headerView[1] === 0x4b &&
        (headerView[2] === 0x03 || headerView[2] === 0x05 || headerView[2] === 0x07) &&
        (headerView[3] === 0x04 || headerView[3] === 0x06 || headerView[3] === 0x08)

      if (isPKZip) {
        console.log("Detected ZIP file from octet-stream")
        // Process as ZIP file
        if (binaryData.byteLength > MAX_ZIP_FILE_SIZE) {
          return NextResponse.json(
            {
              success: false,
              message: `ZIP file too large. Maximum size is ${MAX_ZIP_FILE_SIZE / (1024 * 1024)}MB`,
            },
            { status: 400 },
          )
        }

        try {
          const zip = new JSZip()
          const zipContents = await zip.loadAsync(binaryData)

          // Extract files from the ZIP
          const files: Record<string, string | ArrayBuffer> = {}
          const fileTypes: Record<string, string> = {}
          const htmlFiles: string[] = []
          const jsFiles: string[] = []
          const cssFiles: string[] = []

          // Process all files in the ZIP
          for (const [path, zipEntry] of Object.entries(zipContents.files)) {
            // Skip directories
            if (zipEntry.dir) continue

            try {
              // Get the file content
              const content = await zipEntry.async("arraybuffer")

              // Store the file content
              files[path] = content

              // Determine file type
              if (path.endsWith(".html") || path.endsWith(".htm")) {
                htmlFiles.push(path)
                fileTypes[path] = "text/html"
              } else if (path.endsWith(".css")) {
                cssFiles.push(path)
                fileTypes[path] = "text/css"
              } else if (path.endsWith(".js")) {
                jsFiles.push(path)
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
            } catch (error) {
              console.error(`Error processing ZIP file entry ${path}:`, error)
              // Skip this file but continue processing others
            }
          }

          // If no HTML files found, return an error
          if (htmlFiles.length === 0) {
            console.log("No HTML files found in ZIP")
            return NextResponse.json(
              { success: false, message: "No HTML files found in the ZIP archive" },
              { status: 400 },
            )
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
          content = {
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
              filename: "uploaded.zip", // No filename available for direct uploads
              size: binaryData.byteLength,
              fileCount: Object.keys(files).length,
              htmlFiles: htmlFiles,
              jsFiles: jsFiles,
              cssFiles: cssFiles,
            },
          }

          console.log("Successfully processed ZIP from octet-stream with", htmlFiles.length, "HTML files")
        } catch (error) {
          console.error("Error processing ZIP from octet-stream:", error)
          return NextResponse.json({ success: false, message: "Failed to process ZIP file" }, { status: 400 })
        }
      } else {
        // Not a ZIP file, try to process as text
        console.log("Not a ZIP file, trying to process as text")
        try {
          const text = new TextDecoder().decode(binaryData)

          // Check if it's HTML
          if (isHtml(text)) {
            content = parseHtml(text)
          } else {
            // Try to parse as JSON
            try {
              content = JSON.parse(text)
            } catch (e) {
              // If not JSON, treat as plain text
              content = { type: "text", content: text }
            }
          }
        } catch (error) {
          console.error("Error processing octet-stream as text:", error)
          return NextResponse.json({ success: false, message: "Failed to process binary data" }, { status: 400 })
        }
      }
    } else {
      // Default to text
      console.log("Processing as plain text")
      const text = await request.text()

      // Check if it's HTML
      if (isHtml(text)) {
        content = parseHtml(text)
      } else {
        // Try to parse as JSON
        try {
          content = JSON.parse(text)
        } catch (e) {
          // If not JSON, treat as plain text
          content = { type: "text", content: text }
        }
      }
    }

    // Create a new post with ID and timestamp
    const post = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      content: content,
    }

    // Add the post to KV store
    await addPost(post)

    // Determine content type for response
    const contentTypeResponse = content?.type || "json"

    // For ZIP archives, provide additional information
    let additionalInfo = {}
    if (content?.type === "zip-archive") {
      additionalInfo = {
        fileCount: content.files?.length || 0,
        htmlFiles: content.metadata?.htmlFiles || [],
        mainFile: content.mainFile || "",
      }
    }

    return NextResponse.json({
      success: true,
      message: "Content received and stored",
      postId: post.id,
      contentType: contentTypeResponse,
      ...additionalInfo,
    })
  } catch (error) {
    console.error("Error processing post:", error)
    return NextResponse.json({ success: false, message: "Failed to process request" }, { status: 400 })
  }
}
