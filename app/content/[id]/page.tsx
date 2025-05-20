"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronDown, ChevronRight, Copy, Check, ArrowLeft, Archive } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { HtmlViewer } from "@/components/html-viewer"
import { ZipViewer } from "@/components/zip-viewer"
import Link from "next/link"

interface PostData {
  id: string
  timestamp: string
  content: any
}

export default function ContentPage() {
  const params = useParams()
  const router = useRouter()
  const [post, setPost] = useState<PostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const id = params.id as string
        const response = await fetch(`/api/content/${id}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.status}`)
        }

        const data = await response.json()
        setPost(data)
      } catch (err: any) {
        setError(err.message || "Failed to load content")
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [params.id])

  const toggleNode = (path: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [path]: !prev[path],
    }))
  }

  const copyToClipboard = (content: any) => {
    navigator.clipboard.writeText(JSON.stringify(content, null, 2))
    setCopiedId("copied")
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Recursive function to render JSON with collapsible nodes
  const renderJson = (data: any, path = "", level = 0): JSX.Element => {
    if (data === null) return <span className="text-gray-500">null</span>

    if (typeof data !== "object") {
      // Render primitives with appropriate colors
      if (typeof data === "string") return <span className="text-green-600">"{data}"</span>
      if (typeof data === "number") return <span className="text-blue-600">{data}</span>
      if (typeof data === "boolean") return <span className="text-purple-600">{String(data)}</span>
      return <span>{String(data)}</span>
    }

    const isArray = Array.isArray(data)
    const isEmpty = Object.keys(data).length === 0
    const isExpanded = expandedNodes[path] !== false // Default to expanded for first level

    if (isEmpty) {
      return <span>{isArray ? "[]" : "{}"}</span>
    }

    return (
      <div className="relative pl-4 border-l border-gray-200 dark:border-gray-700">
        <div
          className="flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1"
          onClick={() => toggleNode(path)}
        >
          <span className="mr-1">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <span className="font-mono">
            {isArray ? "[" : "{"} {Object.keys(data).length} {isArray ? "items" : "properties"}{" "}
            {isExpanded ? "" : "..."}
          </span>
        </div>

        {isExpanded && (
          <div className="ml-2">
            {Object.entries(data).map(([key, value], index) => {
              const newPath = path ? `${path}.${key}` : key
              return (
                <div key={newPath} className="my-1">
                  <div className="flex">
                    <span className="font-mono text-gray-500 dark:text-gray-400 mr-2">
                      {isArray ? index : `"${key}"`}:
                    </span>
                    {renderJson(value, newPath, level + 1)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="font-mono">{isArray ? "]" : "}"}</div>
      </div>
    )
  }

  // Alternative view - syntax highlighted JSON
  const renderPrettyJson = (data: any): JSX.Element => {
    const jsonString = JSON.stringify(data, null, 2)

    // Simple syntax highlighting with regex
    const highlighted = jsonString
      .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
      .replace(/"([^"]+)"/g, '<span class="json-string">"$1"</span>')
      .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
      .replace(/\b(null)\b/g, '<span class="json-null">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="json-number">$1</span>')

    return (
      <pre
        className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md overflow-x-auto text-sm"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    )
  }

  // Check if HTML is complex (contains scripts, external resources, etc.)
  const isComplexHtml = (html: string): boolean => {
    return (
      html.includes("<script") ||
      html.includes("<link") ||
      html.includes("<iframe") ||
      html.includes("<canvas") ||
      html.includes("class=") ||
      html.includes("style=") ||
      html.includes("data-") ||
      html.length > 5000 // Consider long HTML as complex
    )
  }

  // Render HTML content
  const renderHtml = (content: any): JSX.Element => {
    // Check if this is parsed HTML content
    if (content.type === "html" && content.html) {
      const htmlContent = content.html

      // Check if HTML is complex
      if (isComplexHtml(htmlContent)) {
        return <HtmlViewer html={htmlContent} title={content.metadata?.title || "HTML Content"} />
      }

      // For simple HTML, use the previous approach with metadata
      return (
        <div className="space-y-4">
          <div className="border rounded-md p-4 bg-white">
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: htmlContent }} />
          </div>

          {/* Metadata (always shown) */}
          {content.metadata && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="metadata">
                <AccordionTrigger>HTML Metadata</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 p-2 bg-gray-50 rounded-md">
                    {/* Title & Description */}
                    {content.metadata.title && (
                      <div className="flex">
                        <span className="font-medium w-24">Title:</span>
                        <span>{content.metadata.title}</span>
                      </div>
                    )}

                    {content.metadata.description && (
                      <div className="flex">
                        <span className="font-medium w-24">Description:</span>
                        <span>{content.metadata.description}</span>
                      </div>
                    )}

                    {/* Headings */}
                    {content.metadata.headings && content.metadata.headings.length > 0 && (
                      <div>
                        <h4 className="font-medium">Headings:</h4>
                        <ul className="list-disc pl-5">
                          {content.metadata.headings.map((heading: any, i: number) => (
                            <li key={i} className={`ml-${heading.level * 2}`}>
                              {heading.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Links */}
                    {content.metadata.links && content.metadata.links.length > 0 && (
                      <div>
                        <h4 className="font-medium">Links:</h4>
                        <ul className="list-disc pl-5">
                          {content.metadata.links.slice(0, 5).map((link: any, i: number) => (
                            <li key={i}>
                              <span>{link.text}</span>
                              <span className="text-gray-500 text-sm ml-2">({link.href})</span>
                            </li>
                          ))}
                          {content.metadata.links.length > 5 && (
                            <li className="text-gray-500">...and {content.metadata.links.length - 5} more links</li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Images */}
                    {content.metadata.images && content.metadata.images.length > 0 && (
                      <div>
                        <h4 className="font-medium">Images:</h4>
                        <ul className="list-disc pl-5">
                          {content.metadata.images.slice(0, 5).map((image: any, i: number) => (
                            <li key={i}>
                              <span>{image.alt || "Image"}</span>
                              <span className="text-gray-500 text-sm ml-2">({image.src})</span>
                            </li>
                          ))}
                          {content.metadata.images.length > 5 && (
                            <li className="text-gray-500">...and {content.metadata.images.length - 5} more images</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      )
    }

    // Fallback to JSON display
    return renderJson(content)
  }

  // Render ZIP archive content
  const renderZipArchive = (content: any): JSX.Element => {
    if (content.type === "zip-archive") {
      return <ZipViewer zipData={content} postId={post?.id} />
    }

    // Fallback to JSON display
    return renderJson(content)
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center mb-6">
          <Button variant="ghost" asChild className="mr-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Link>
          </Button>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading content...</p>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center mb-6">
          <Button variant="ghost" asChild className="mr-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Link>
          </Button>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-red-500">{error || "Content not found"}</p>
        </div>
      </div>
    )
  }

  // Determine content type for display
  const isZipArchive = post.content.type === "zip-archive"
  const isHtmlContent = post.content.type === "html"

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" asChild className="mr-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Content Details</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => copyToClipboard(post.content)}
          title="Copy Content"
          className="ml-auto"
        >
          {copiedId ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      <div className="mb-4 flex items-center">
        <Badge className="mr-2">ID: {post.id}</Badge>
        <Badge variant="outline">{new Date(post.timestamp).toLocaleString()}</Badge>
        {isZipArchive && (
          <Badge variant="outline" className="ml-2 bg-blue-50">
            <Archive className="h-3 w-3 mr-1" />
            ZIP Archive
          </Badge>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue={isZipArchive ? "zip" : isHtmlContent ? "html" : "interactive"}>
            <TabsList className="mb-2">
              {isZipArchive ? (
                <TabsTrigger value="zip">ZIP Archive</TabsTrigger>
              ) : isHtmlContent ? (
                <TabsTrigger value="html">HTML</TabsTrigger>
              ) : (
                <TabsTrigger value="interactive">Interactive</TabsTrigger>
              )}
              <TabsTrigger value="raw">Raw</TabsTrigger>
            </TabsList>

            {isZipArchive ? (
              <TabsContent value="zip" className="mt-0">
                {renderZipArchive(post.content)}
              </TabsContent>
            ) : isHtmlContent ? (
              <TabsContent value="html" className="mt-0">
                {renderHtml(post.content)}
              </TabsContent>
            ) : (
              <TabsContent value="interactive" className="mt-0">
                {renderJson(post.content, `post-${post.id}`)}
              </TabsContent>
            )}

            <TabsContent value="raw" className="mt-0">
              {renderPrettyJson(post.content)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
