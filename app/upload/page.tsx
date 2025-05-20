"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, ArrowLeft, Archive } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"

export default function UploadPage() {
  const router = useRouter()
  const [jsonData, setJsonData] = useState(
    '{\n  "example": "Enter your JSON here",\n  "array": [1, 2, 3],\n  "nested": {\n    "value": true\n  }\n}',
  )
  const [htmlData, setHtmlData] = useState(
    "<!DOCTYPE html>\n<html>\n<head>\n  <title>Example HTML</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n  <p>This is an example HTML document.</p>\n  <ul>\n    <li>Item 1</li>\n    <li>Item 2</li>\n  </ul>\n</body>\n</html>",
  )
  const [file, setFile] = useState<File | null>(null)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [response, setResponse] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleJsonSubmit = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      // Parse JSON to validate it
      const parsedJson = JSON.parse(jsonData)

      const response = await fetch("/api/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: jsonData,
      })

      const result = await response.json()
      setResponse(result)

      // Navigate to the content page after a short delay
      if (result.success && result.postId) {
        setTimeout(() => {
          router.push(`/content/${result.postId}`)
        }, 1500)
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit JSON data")
    } finally {
      setLoading(false)
    }
  }

  const handleHtmlSubmit = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const response = await fetch("/api/post", {
        method: "POST",
        headers: {
          "Content-Type": "text/html",
        },
        body: htmlData,
      })

      const result = await response.json()
      setResponse(result)

      // Navigate to the content page after a short delay
      if (result.success && result.postId) {
        setTimeout(() => {
          router.push(`/content/${result.postId}`)
        }, 1500)
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit HTML data")
    } finally {
      setLoading(false)
    }
  }

  const handleFileSubmit = async () => {
    if (!file) {
      setError("Please select a file first")
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const formData = new FormData()
      formData.append("html", file)

      const response = await fetch("/api/post", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      setResponse(result)

      // Navigate to the content page after a short delay
      if (result.success && result.postId) {
        setTimeout(() => {
          router.push(`/content/${result.postId}`)
        }, 1500)
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload file")
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const handleZipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      setZipFile(file)
    }
  }

  const handleZipSubmit = async () => {
    if (!zipFile) {
      setError("Please select a ZIP file first")
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const formData = new FormData()
      formData.append("file", zipFile) // Use the same field name as other uploads

      const response = await fetch("/api/post", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      setResponse(result)

      // Navigate to the content page after a short delay
      if (result.success && result.postId) {
        setTimeout(() => {
          router.push(`/content/${result.postId}`)
        }, 1500)
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload ZIP file")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center mb-6">
        <Button variant="ghost" asChild className="mr-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Upload Content</h1>
      </div>

      <p className="mb-6 text-muted-foreground">
        Use this page to test sending different types of content to your API.
      </p>

      <Tabs defaultValue="json" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="html">HTML</TabsTrigger>
          <TabsTrigger value="file">File Upload</TabsTrigger>
          <TabsTrigger value="zip">ZIP Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="json">
          <Card>
            <CardHeader>
              <CardTitle>Submit JSON Data</CardTitle>
              <CardDescription>Enter JSON data to send to your API</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea value={jsonData} onChange={(e) => setJsonData(e.target.value)} className="font-mono h-64" />
            </CardContent>
            <CardFooter>
              <Button onClick={handleJsonSubmit} disabled={loading}>
                {loading ? "Submitting..." : "Submit JSON"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="html">
          <Card>
            <CardHeader>
              <CardTitle>Submit HTML Data</CardTitle>
              <CardDescription>Enter HTML content to send to your API</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea value={htmlData} onChange={(e) => setHtmlData(e.target.value)} className="font-mono h-64" />
            </CardContent>
            <CardFooter>
              <Button onClick={handleHtmlSubmit} disabled={loading}>
                {loading ? "Submitting..." : "Submit HTML"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="file">
          <Card>
            <CardHeader>
              <CardTitle>Upload HTML File</CardTitle>
              <CardDescription>Upload an HTML file to send to your API</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="file">HTML File</Label>
                <Input id="file" type="file" accept=".html,.htm" onChange={handleFileChange} />
              </div>
              {file && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Selected file: {file.name} ({Math.round(file.size / 1024)} KB)
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleFileSubmit} disabled={loading || !file}>
                {loading ? "Uploading..." : "Upload File"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="zip">
          <Card>
            <CardHeader>
              <CardTitle>Upload ZIP File</CardTitle>
              <CardDescription>Upload a ZIP file containing HTML and supporting files</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid w-full items-center gap-4">
                <div>
                  <Label htmlFor="zipFile">ZIP File</Label>
                  <Input id="zipFile" type="file" accept=".zip" onChange={handleZipFileChange} />
                  {zipFile && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Selected file: {zipFile.name} ({Math.round(zipFile.size / 1024)} KB)
                    </p>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium mb-2 flex items-center">
                    <Archive className="h-4 w-4 mr-1" />
                    Instructions
                  </h3>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    <li>ZIP file should contain an HTML file at the root or in a folder</li>
                    <li>
                      Supporting files (images, CSS) should be in the same relative locations as referenced in HTML
                    </li>
                    <li>The system will automatically detect the main HTML file</li>
                    <li>Maximum ZIP file size: 10MB</li>
                  </ul>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleZipSubmit} disabled={loading || !zipFile}>
                {loading ? "Uploading..." : "Upload ZIP"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {response && (
        <Alert className="mt-6 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription>
            <pre className="mt-2 bg-white p-2 rounded border text-sm overflow-auto">
              {JSON.stringify(response, null, 2)}
            </pre>
            {response.success && response.postId && (
              <p className="mt-2 text-green-700">Redirecting to content page...</p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
