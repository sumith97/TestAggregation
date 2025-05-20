"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, Code, Download, ExternalLink, X, Images } from "lucide-react"

interface HtmlViewerProps {
  html: string
  title?: string
  basePath?: string
  zipFileContents?: Record<string, { type: string; content: string }>
}

export function HtmlViewer({ html, title = "HTML Preview", basePath = "", zipFileContents }: HtmlViewerProps) {
  const [activeTab, setActiveTab] = useState<string>("preview")
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeHeight, setIframeHeight] = useState(600)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [extractedImages, setExtractedImages] = useState<{ src: string; alt: string }[]>([])

  // Create a blob URL for the HTML content
  const [blobUrl, setBlobUrl] = useState<string>("")

  useEffect(() => {
    // Process HTML to fix relative paths if zipFileContents is provided
    let processedHtml = html

    if (zipFileContents) {
      // Fix relative paths and extract images
      const { processedContent, images } = processHtmlAndExtractImages(processedHtml, basePath, zipFileContents)
      processedHtml = processedContent
      setExtractedImages(images)
    } else {
      // Extract images from regular HTML
      const images = extractImagesFromHtml(processedHtml)
      setExtractedImages(images)
    }

    // Fix the Extent Reports lightbox issue
    processedHtml = fixExtentReportsLightbox(processedHtml)

    // Create a blob from the HTML content
    const blob = new Blob([processedHtml], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)

    // Clean up the blob URL when the component unmounts
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [html, basePath, zipFileContents])

  // Fix Extent Reports lightbox functionality
  const fixExtentReportsLightbox = (htmlContent: string): string => {
    // Check if this is an Extent Report
    if (htmlContent.includes("extent") && htmlContent.includes("screenshots")) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlContent, "text/html")

      // Add a fix script at the end of the body
      const fixScript = doc.createElement("script")
      fixScript.textContent = `
        // Fix for Extent Reports lightbox
        document.addEventListener('DOMContentLoaded', function() {
          // Fix for image modal/lightbox
          var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
              if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                for (var i = 0; i < mutation.addedNodes.length; i++) {
                  var node = mutation.addedNodes[i];
                  if (node.nodeType === 1 && (
                      node.classList.contains('modal') || 
                      node.id === 'lightbox-img' || 
                      node.classList.contains('modal-backdrop')
                    )) {
                    fixModalImages();
                  }
                }
              }
            });
          });
          
          // Start observing the document
          observer.observe(document.body, { childList: true, subtree: true });
          
          // Add click handlers to all images
          var images = document.querySelectorAll('img');
          images.forEach(function(img) {
            if (!img.getAttribute('data-featherlight')) {
              img.addEventListener('click', function() {
                // Store the image source for the modal
                window.lastClickedImageSrc = this.src;
                setTimeout(fixModalImages, 100);
              });
            }
          });
          
          function fixModalImages() {
            // Find modal images that need fixing
            var modalImages = document.querySelectorAll('.modal img, #lightbox-img');
            modalImages.forEach(function(img) {
              if (window.lastClickedImageSrc && (img.src === '' || img.src === 'about:blank' || img.src.endsWith('#'))) {
                img.src = window.lastClickedImageSrc;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '80vh';
                img.style.margin = '0 auto';
                img.style.display = 'block';
                
                // Also fix the parent modal
                var modal = img.closest('.modal');
                if (modal) {
                  modal.style.display = 'block';
                  modal.style.paddingRight = '17px';
                  modal.classList.add('show');
                  
                  // Make sure backdrop exists
                  if (!document.querySelector('.modal-backdrop')) {
                    var backdrop = document.createElement('div');
                    backdrop.className = 'modal-backdrop fade show';
                    document.body.appendChild(backdrop);
                  }
                  
                  // Add close handler to backdrop
                  var backdrops = document.querySelectorAll('.modal-backdrop');
                  backdrops.forEach(function(backdrop) {
                    backdrop.addEventListener('click', function() {
                      closeAllModals();
                    });
                  });
                }
              }
            });
            
            // Make sure close buttons work
            var closeButtons = document.querySelectorAll('.modal .close, .modal [data-dismiss="modal"]');
            closeButtons.forEach(function(button) {
              button.addEventListener('click', function() {
                closeAllModals();
              });
            });
          }
          
          function closeAllModals() {
            var modals = document.querySelectorAll('.modal');
            modals.forEach(function(modal) {
              modal.style.display = 'none';
              modal.classList.remove('show');
            });
            
            var backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(function(backdrop) {
              backdrop.parentNode.removeChild(backdrop);
            });
            
            document.body.classList.remove('modal-open');
            document.body.style.paddingRight = '';
          }
          
          // Add keyboard support
          document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
              closeAllModals();
            }
          });
        });
      `

      doc.body.appendChild(fixScript)

      // Add some CSS fixes
      const styleTag = doc.createElement("style")
      styleTag.textContent = `
        .modal {
          background-color: rgba(0,0,0,0.5);
        }
        .modal-dialog {
          max-width: 80%;
          margin: 30px auto;
        }
        .modal-content {
          background-color: transparent;
          border: none;
          box-shadow: none;
        }
        .modal img {
          max-width: 100%;
          max-height: 80vh;
          margin: 0 auto;
          display: block;
          background-color: white;
          padding: 10px;
          border-radius: 5px;
          box-shadow: 0 0 20px rgba(0,0,0,0.3);
        }
        .modal .close {
          color: white;
          font-size: 30px;
          font-weight: bold;
          position: absolute;
          right: 15px;
          top: 5px;
          z-index: 999;
          opacity: 0.8;
          text-shadow: 0 0 5px black;
        }
        .modal .close:hover {
          opacity: 1;
        }
      `
      doc.head.appendChild(styleTag)

      return doc.documentElement.outerHTML
    }

    return htmlContent
  }

  // Extract images from HTML
  const extractImagesFromHtml = (htmlContent: string): { src: string; alt: string }[] => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlContent, "text/html")
    const images: { src: string; alt: string }[] = []

    doc.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src")
      if (src && !src.startsWith("data:image/svg+xml") && src !== "") {
        // Skip SVG placeholders and empty src attributes
        images.push({
          src: src,
          alt: img.getAttribute("alt") || "Image",
        })
      }
    })

    return images
  }

  // Process HTML and extract images
  const processHtmlAndExtractImages = (
    htmlContent: string,
    basePath: string,
    zipContents: Record<string, { type: string; content: string }>,
  ): { processedContent: string; images: { src: string; alt: string }[] } => {
    // Create a temporary DOM element to parse the HTML
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlContent, "text/html")
    const images: { src: string; alt: string }[] = []

    // Get the base directory from the basePath
    const baseDir = basePath.split("/").slice(0, -1).join("/") + "/"

    // Process image tags
    const imgElements = doc.querySelectorAll("img")
    imgElements.forEach((img) => {
      const src = img.getAttribute("src")
      if (src && !src.startsWith("data:") && !src.startsWith("http")) {
        // Resolve the path relative to the base directory
        const resolvedPath = resolveRelativePath(baseDir, src)

        // Check if this file exists in the ZIP contents
        if (zipContents[resolvedPath]) {
          // Create a data URL for the image
          const fileType = zipContents[resolvedPath].type
          const fileContent = zipContents[resolvedPath].content
          const dataUrl = `data:${fileType};base64,${fileContent}`
          img.setAttribute("src", dataUrl)

          // Add to extracted images
          if (fileType.startsWith("image/") && !fileType.includes("svg")) {
            images.push({
              src: dataUrl,
              alt: img.getAttribute("alt") || resolvedPath,
            })
          }
        } else {
          // If the image doesn't exist in the ZIP, remove the src attribute to avoid browser warnings
          img.removeAttribute("src")
          img.setAttribute("alt", `Missing image: ${src}`)
        }
      } else if (src && (src.startsWith("data:image/") || src.startsWith("http"))) {
        // Add direct images to the extracted list
        if (!src.includes("svg")) {
          images.push({
            src: src,
            alt: img.getAttribute("alt") || "Image",
          })
        }
      } else if (!src || src === "") {
        // Remove empty src attributes
        img.removeAttribute("src")
        if (!img.getAttribute("alt")) {
          img.setAttribute("alt", "Image with missing source")
        }
      }
    })

    // Process CSS links
    const links = doc.querySelectorAll('link[rel="stylesheet"]')
    links.forEach((link) => {
      const href = link.getAttribute("href")
      if (href && !href.startsWith("http")) {
        const resolvedPath = resolveRelativePath(baseDir, href)
        if (zipContents[resolvedPath]) {
          // Create a style element instead of link
          const style = doc.createElement("style")
          style.textContent = atob(zipContents[resolvedPath].content)
          link.parentNode?.replaceChild(style, link)
        }
      }
    })

    // Process JavaScript files
    const scripts = doc.querySelectorAll("script[src]")
    scripts.forEach((script) => {
      const src = script.getAttribute("src")
      if (src && !src.startsWith("http")) {
        const resolvedPath = resolveRelativePath(baseDir, src)
        if (zipContents[resolvedPath]) {
          // Create an inline script element
          const inlineScript = doc.createElement("script")
          inlineScript.textContent = atob(zipContents[resolvedPath].content)
          script.parentNode?.replaceChild(inlineScript, script)
        }
      }
    })

    return {
      processedContent: doc.documentElement.outerHTML,
      images: images,
    }
  }

  // Helper function to resolve relative paths
  const resolveRelativePath = (baseDir: string, relativePath: string): string => {
    // Handle paths starting with ./
    if (relativePath.startsWith("./")) {
      return baseDir + relativePath.substring(2)
    }

    // Handle paths starting with ../
    if (relativePath.startsWith("../")) {
      const baseParts = baseDir.split("/").filter(Boolean)
      const relativeParts = relativePath.split("/")

      const resultParts = [...baseParts]

      for (const part of relativeParts) {
        if (part === "..") {
          resultParts.pop()
        } else if (part !== ".") {
          resultParts.push(part)
        }
      }

      return resultParts.join("/")
    }

    // Handle absolute paths (starting with /)
    if (relativePath.startsWith("/")) {
      return relativePath.substring(1) // Remove leading slash
    }

    // Handle simple relative paths
    return baseDir + relativePath
  }

  // Handle iframe load event
  const handleIframeLoad = () => {
    setIframeLoaded(true)

    // Try to adjust iframe height based on content
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        const height = iframeRef.current.contentWindow.document.body.scrollHeight
        setIframeHeight(Math.max(600, height))
      }
    } catch (e) {
      console.error("Could not adjust iframe height:", e)
    }
  }

  // Download HTML as a file
  const downloadHtml = () => {
    // Process HTML before downloading to ensure all resources are included
    let processedHtml = html
    if (zipFileContents) {
      const { processedContent } = processHtmlAndExtractImages(processedHtml, basePath, zipFileContents)
      processedHtml = processedContent
    }

    // Fix Extent Reports lightbox
    processedHtml = fixExtentReportsLightbox(processedHtml)

    const element = document.createElement("a")
    const file = new Blob([processedHtml], { type: "text/html" })
    element.href = URL.createObjectURL(file)
    element.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.html`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  // Open image gallery in new tab
  const openImagesInNewTab = () => {
    // Create a simple HTML gallery page
    const galleryHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Images from ${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.5;
          margin: 0;
          padding: 20px;
          background-color: #f5f5f5;
        }
        h1 {
          text-align: center;
          margin-bottom: 20px;
        }
        .gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .image-container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          transition: transform 0.2s;
        }
        .image-container:hover {
          transform: translateY(-5px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }
        .image-container img {
          width: 100%;
          height: auto;
          display: block;
          cursor: pointer;
        }
        .image-caption {
          padding: 10px;
          font-size: 14px;
          color: #555;
          text-align: center;
          word-break: break-word;
        }
        .back-link {
          display: block;
          text-align: center;
          margin-bottom: 20px;
          color: #0070f3;
          text-decoration: none;
        }
        .back-link:hover {
          text-decoration: underline;
        }
        .empty-message {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 8px;
          margin: 40px auto;
          max-width: 500px;
        }
      </style>
    </head>
    <body>
      <a href="javascript:window.close()" class="back-link">← Close Gallery</a>
      <h1>Images from ${title}</h1>
      ${
        extractedImages.length === 0
          ? `<div class="empty-message">No images found in this document.</div>`
          : `<div class="gallery">
          ${extractedImages
            .map((img, index) => {
              // Make sure we don't have empty src attributes
              if (!img.src) return ""

              return `
                <div class="image-container">
                  <a href="${img.src}" target="_blank">
                    <img src="${img.src}" alt="${img.alt}" title="Click to open full size in new tab">
                  </a>
                  <div class="image-caption">Image ${index + 1}: ${img.alt}</div>
                </div>
              `
            })
            .join("")}
        </div>`
      }
    </body>
    </html>
    `

    // Create a blob and open in new tab
    const blob = new Blob([galleryHtml], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank")
  }

  // Open in new tab (original HTML)
  const openInNewTab = () => {
    // Process HTML before opening
    let processedHtml = html
    if (zipFileContents) {
      const { processedContent } = processHtmlAndExtractImages(processedHtml, basePath, zipFileContents)
      processedHtml = processedContent
    }

    // Fix Extent Reports lightbox
    processedHtml = fixExtentReportsLightbox(processedHtml)

    const blob = new Blob([processedHtml], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank")
  }

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="preview" className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>Preview</span>
            </TabsTrigger>
            <TabsTrigger value="source" className="flex items-center gap-1">
              <Code className="h-4 w-4" />
              <span>Source</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openImagesInNewTab} className="flex items-center gap-1">
              <Images className="h-4 w-4" />
              <span>View Images</span>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadHtml} className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              <span>Download</span>
            </Button>
            <Button variant="outline" size="sm" onClick={openInNewTab} className="flex items-center gap-1">
              <ExternalLink className="h-4 w-4" />
              <span>Open in New Tab</span>
            </Button>
          </div>
        </div>

        <TabsContent value="preview" className="mt-0">
          <div className="border rounded-md bg-white">
            {!iframeLoaded && (
              <div className="flex justify-center items-center h-[600px] bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            )}
            {blobUrl && (
              <iframe
                ref={iframeRef}
                src={blobUrl}
                className="w-full rounded-md"
                style={{
                  height: `${iframeHeight}px`,
                  display: iframeLoaded ? "block" : "none",
                }}
                sandbox="allow-scripts allow-same-origin"
                onLoad={handleIframeLoad}
                title={title}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="source" className="mt-0">
          <pre className="border rounded-md p-4 bg-gray-50 overflow-auto text-sm h-[600px]">{html}</pre>
        </TabsContent>
      </Tabs>

      {/* Lightbox for enlarged images */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-black bg-opacity-50 text-white hover:bg-opacity-70"
              onClick={(e) => {
                e.stopPropagation()
                setLightboxImage(null)
              }}
            >
              <X className="h-6 w-6" />
            </Button>
            {lightboxImage && (
              <img
                src={lightboxImage || "/placeholder.svg"}
                alt="Enlarged view"
                className="max-w-full max-h-[90vh] object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
