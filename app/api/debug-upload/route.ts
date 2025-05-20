import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // Get content type and other headers
    const contentType = request.headers.get("content-type") || ""
    const contentLength = request.headers.get("content-length") || "unknown"

    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })

    let body: any = "Could not parse body"

    // Try to get body info based on content type
    if (contentType.includes("application/json")) {
      try {
        body = await request.json()
      } catch (e) {
        body = "Failed to parse JSON"
      }
    } else if (contentType.includes("multipart/form-data")) {
      try {
        const formData = await request.formData()
        const formDataInfo: Record<string, any> = {}

        formData.forEach((value, key) => {
          if (value instanceof File) {
            formDataInfo[key] = {
              type: "File",
              name: value.name,
              size: value.size,
              contentType: value.type,
              lastModified: new Date(value.lastModified).toISOString(),
            }
          } else {
            formDataInfo[key] = value
          }
        })

        body = formDataInfo
      } catch (e) {
        body = "Failed to parse form data"
      }
    } else if (contentType.includes("application/octet-stream") || contentType.includes("application/zip")) {
      const buffer = await request.arrayBuffer()
      body = {
        type: "Binary data",
        size: buffer.byteLength,
        magicBytes: Array.from(new Uint8Array(buffer.slice(0, 16)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" "),
      }
    } else {
      try {
        body = await request.text()
        if (body.length > 1000) {
          body = body.substring(0, 1000) + "... (truncated)"
        }
      } catch (e) {
        body = "Failed to get text body"
      }
    }

    return NextResponse.json({
      success: true,
      requestInfo: {
        method: request.method,
        url: request.url,
        contentType,
        contentLength,
        headers,
        body,
      },
    })
  } catch (error) {
    console.error("Error in debug endpoint:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error processing request",
        error: String(error),
      },
      { status: 500 },
    )
  }
}
