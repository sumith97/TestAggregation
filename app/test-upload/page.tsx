"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"

export default function TestUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [response, setResponse] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const handleDirectUpload = async () => {
    if (!file) {
      setError("Please select a file first")
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)
    setDebugInfo(null)

    try {
      // Upload the file directly (not in a FormData)
      const response = await fetch("/api/post", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      })

      const result = await response.json()
      setResponse(result)
    } catch (err: any) {
      setError(err.message || "Failed to upload file")
    } finally {
      setLoading(false)
    }
  }

  const handleFormDataUpload = async () => {
    if (!file) {
      setError("Please select a file first")
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)
    setDebugInfo(null)

    try {
      // Upload using FormData
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/post", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      setResponse(result)
    } catch (err: any) {
      setError(err.message || "Failed to upload file")
    } finally {
      setLoading(false)
    }
  }

  const handleDebugUpload = async () => {
    if (!file) {
      setError("Please select a file first")
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)
    setDebugInfo(null)

    try {
      // Test with debug endpoint
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/debug-upload", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      setDebugInfo(result)
    } catch (err: any) {
      setError(err.message || "Failed to debug upload")
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
        <h1 className="text-2xl font-bold">Test ZIP Upload</h1>
      </div>

      <p className="mb-6 text-muted-foreground">
        Use this page to test different methods of uploading ZIP files to the API.
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload ZIP File</CardTitle>
          <CardDescription>Select a ZIP file to upload using different methods</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full max-w-sm items-center gap-1.5 mb-4">
            <Label htmlFor="file">ZIP File</Label>
            <Input id="file" type="file" accept=".zip" onChange={handleFileChange} />
          </div>
          {file && (
            <p className="text-sm text-muted-foreground">
              Selected file: {file.name} ({Math.round(file.size / 1024)} KB, type: {file.type || "unknown"})
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2 items-start">
          <Button onClick={handleDirectUpload} disabled={loading || !file}>
            {loading ? "Uploading..." : "Upload Directly"}
          </Button>
          <Button onClick={handleFormDataUpload} disabled={loading || !file} variant="outline">
            {loading ? "Uploading..." : "Upload as FormData"}
          </Button>
          <Button onClick={handleDebugUpload} disabled={loading || !file} variant="secondary">
            {loading ? "Debugging..." : "Debug Upload"}
          </Button>
        </CardFooter>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {response && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription>
            <pre className="mt-2 bg-white p-2 rounded border text-sm overflow-auto">
              {JSON.stringify(response, null, 2)}
            </pre>
          </AlertDescription>
        </Alert>
      )}

      {debugInfo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
            <CardDescription>Details about the upload request</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-sm">{JSON.stringify(debugInfo, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
