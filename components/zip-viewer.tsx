"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { HtmlViewer } from "@/components/html-viewer"
import {
  Folder,
  File,
  ImageIcon,
  Code,
  FileText,
  Download,
  Eye,
  Archive,
  ChevronRight,
  ChevronDown,
} from "lucide-react"

interface ZipFile {
  path: string
  type: string
  size: number
}

interface ZipFileContent {
  type: string
  content: string // base64 encoded
}

interface ZipViewerProps {
  zipData: {
    mainFile: string
    files: ZipFile[]
    fileContents: Record<string, ZipFileContent>
    html: any
    metadata?: {
      filename?: string
    }
  }
  postId?: string
}

// Helper function to build a directory tree
interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  children: Record<string, TreeNode>
  file?: ZipFile
}

export function ZipViewer({ zipData, postId }: ZipViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string>(zipData.mainFile)
  const [downloading, setDownloading] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})

  // Get the content of the selected file
  const getFileContent = (path: string) => {
    const fileData = zipData.fileContents[path]
    if (!fileData) return null

    return {
      type: fileData.type,
      content: atob(fileData.content), // Decode base64
    }
  }

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />
    if (type === "text/html") return <FileText className="h-4 w-4" />
    if (type === "text/css" || type === "text/javascript") return <Code className="h-4 w-4" />
    return <File className="h-4 w-4" />
  }

  // Build directory tree from flat file list
  const buildDirectoryTree = () => {
    const root: TreeNode = {
      name: "root",
      path: "",
      isDirectory: true,
      children: {},
    }

    // Sort files to ensure directories are processed before their children
    const sortedFiles = [...zipData.files].sort((a, b) => a.path.localeCompare(b.path))

    // Track all folder paths to initialize expansion state
    const folderPaths: string[] = []

    sortedFiles.forEach((file) => {
      const pathParts = file.path.split("/")
      let currentNode = root
      let currentPath = ""

      // Process each part of the path
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i]
        const isLastPart = i === pathParts.length - 1

        // Build the current path
        currentPath = currentPath ? `${currentPath}/${part}` : part

        // If this is a directory part, track it for expansion state
        if (!isLastPart) {
          folderPaths.push(currentPath)
        }

        if (!currentNode.children[part]) {
          currentNode.children[part] = {
            name: part,
            path: currentPath,
            isDirectory: !isLastPart,
            children: {},
            file: isLastPart ? file : undefined,
          }
        }

        currentNode = currentNode.children[part]
      }
    })

    // Initialize expansion state for all folders if not already set
    if (Object.keys(expandedFolders).length === 0) {
      const initialState: Record<string, boolean> = {}
      folderPaths.forEach((path) => {
        initialState[path] = true // Start with all folders expanded
      })
      setExpandedFolders(initialState)
    }

    return root
  }

  // Toggle folder expansion
  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !(prev[path] ?? true), // Toggle from current state, default to true if not set
    }))
  }

  // Check if a folder is expanded
  const isFolderExpanded = (path: string) => {
    // If the path exists in state, use that value, otherwise default to true
    return expandedFolders[path] ?? true
  }

  // Render file tree recursively
  const renderFileTree = (node: TreeNode, level = 0) => {
    if (!node) return null

    // Sort children: directories first, then files, both alphabetically
    const sortedChildren = Object.values(node.children).sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })

    return (
      <div style={{ marginLeft: level > 0 ? "16px" : "0" }}>
        {sortedChildren.map((child) => {
          if (child.isDirectory) {
            const isExpanded = isFolderExpanded(child.path)
            return (
              <div key={child.path}>
                <div
                  className="flex items-center py-1 px-2 hover:bg-gray-100 rounded cursor-pointer"
                  onClick={() => toggleFolder(child.path)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 mr-1 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-1 text-gray-500" />
                  )}
                  <Folder className="h-4 w-4 mr-2 text-blue-500" />
                  <span className="text-sm font-medium">{child.name}</span>
                </div>
                {isExpanded && renderFileTree(child, level + 1)}
              </div>
            )
          } else {
            return (
              <div
                key={child.path}
                className={`flex items-center py-1 px-2 rounded cursor-pointer hover:bg-gray-100 ml-6 ${
                  selectedFile === child.path ? "bg-blue-50 text-blue-600" : ""
                }`}
                onClick={() => setSelectedFile(child.path)}
              >
                {getFileIcon(child.file?.type || "application/octet-stream")}
                <span className="ml-2 text-sm truncate">{child.name}</span>
              </div>
            )
          }
        })}
      </div>
    )
  }

  // Download the entire ZIP file
  const downloadZipFile = async () => {
    if (!postId) return

    try {
      setDownloading(true)

      // Create a direct link to the download endpoint
      const downloadUrl = `/api/download/${postId}`

      // Create a temporary link element and trigger the download
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = zipData.metadata?.filename || `download-${postId}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Error downloading ZIP file:", error)
    } finally {
      setDownloading(false)
    }
  }

  // Render file content based on type
  const renderFileContent = () => {
    const fileData = getFileContent(selectedFile)
    if (!fileData) return <div>File not found</div>

    if (fileData.type === "text/html") {
      return (
        <HtmlViewer
          html={fileData.content}
          title={selectedFile}
          basePath={selectedFile}
          zipFileContents={zipData.fileContents}
        />
      )
    }

    if (fileData.type.startsWith("image/")) {
      // Make sure we have valid content before creating the data URL
      const fileContent = zipData.fileContents[selectedFile]?.content
      if (!fileContent) {
        return <div>Image content not available</div>
      }

      const imageUrl = `data:${fileData.type};base64,${fileContent}`

      return (
        <div className="flex flex-col items-center justify-center p-4">
          <img
            src={imageUrl || "/placeholder.svg"}
            alt={`File: ${selectedFile.split("/").pop() || "image"}`}
            className="max-w-full max-h-[600px] object-contain"
          />
          <p className="mt-2 text-sm text-gray-500">{selectedFile}</p>
        </div>
      )
    }

    if (fileData.type === "text/css" || fileData.type === "text/javascript" || fileData.type.startsWith("text/")) {
      return <pre className="p-4 bg-gray-50 rounded-md overflow-auto text-sm h-[600px]">{fileData.content}</pre>
    }

    return (
      <div className="flex flex-col items-center justify-center p-4">
        <p>Binary file: {selectedFile}</p>
        <p className="text-sm text-gray-500">File type: {fileData.type}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            const fileContent = zipData.fileContents[selectedFile]?.content
            if (!fileContent) return

            const blob = new Blob([Uint8Array.from(atob(fileContent), (c) => c.charCodeAt(0))], { type: fileData.type })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = selectedFile.split("/").pop() || "download"
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Download File
        </Button>
      </div>
    )
  }

  // Build the directory tree
  const directoryTree = buildDirectoryTree()

  // Count files and folders
  const countFiles = zipData.files.length
  const countFolders = Object.keys(expandedFolders).length

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">ZIP Archive Contents</h3>
        {postId && (
          <Button
            variant="outline"
            size="sm"
            onClick={downloadZipFile}
            disabled={downloading}
            className="flex items-center gap-1"
          >
            <Archive className="h-4 w-4" />
            <span>{downloading ? "Downloading..." : "Download ZIP"}</span>
          </Button>
        )}
      </div>

      <Tabs defaultValue="files" className="w-full">
        <TabsList>
          <TabsTrigger value="files" className="flex items-center gap-1">
            <Folder className="h-4 w-4" />
            <span>Files</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            <span>Preview</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="border rounded-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-md p-2 overflow-auto h-[600px]">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">Files ({countFiles})</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Toggle all folders
                    const allExpanded = Object.values(expandedFolders).every((v) => v !== false)
                    const newState = !allExpanded

                    // Create a new state object with all folders set to the new state
                    const newExpandedFolders: Record<string, boolean> = {}
                    Object.keys(expandedFolders).forEach((key) => {
                      newExpandedFolders[key] = newState
                    })

                    setExpandedFolders(newExpandedFolders)
                  }}
                  className="text-xs h-7"
                >
                  {Object.values(expandedFolders).every((v) => v !== false) ? "Collapse All" : "Expand All"}
                </Button>
              </div>

              {renderFileTree(directoryTree)}
            </div>

            <div className="border rounded-md p-4 col-span-1 md:col-span-2 overflow-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium flex items-center">
                  {getFileIcon(zipData.fileContents[selectedFile]?.type || "application/octet-stream")}
                  <span className="ml-2 truncate">{selectedFile}</span>
                </h3>

                <div className="text-sm text-gray-500">
                  {zipData.fileContents[selectedFile] &&
                    `${(atob(zipData.fileContents[selectedFile].content).length / 1024).toFixed(2)} KB`}
                </div>
              </div>

              {renderFileContent()}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-0">
          {zipData.fileContents[zipData.mainFile] ? (
            <HtmlViewer
              html={getFileContent(zipData.mainFile)?.content || ""}
              title={zipData.mainFile.split("/").pop() || "HTML Preview"}
              basePath={zipData.mainFile}
              zipFileContents={zipData.fileContents}
            />
          ) : (
            <div className="p-4 text-center">Main HTML file not found or cannot be displayed</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
