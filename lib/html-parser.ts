import * as cheerio from "cheerio"

/**
 * Parse HTML content and extract structured data
 */
export function parseHtml(html: string) {
  try {
    const $ = cheerio.load(html)

    // Extract basic metadata
    const metadata = {
      title: $("title").text() || $("h1").first().text() || "Untitled Document",
      description: $('meta[name="description"]').attr("content") || $("p").first().text().substring(0, 150) || "",
      links: [] as { href: string; text: string }[],
      headings: [] as { level: number; text: string }[],
      images: [] as { src: string; alt: string }[],
      hasScripts: $("script").length > 0,
      hasStyles: $("link[rel='stylesheet']").length > 0 || $("style").length > 0,
      hasIframes: $("iframe").length > 0,
      complexity: "simple" as "simple" | "complex",
    }

    // Extract links
    $("a").each((i, el) => {
      const href = $(el).attr("href")
      const text = $(el).text().trim()
      if (href) {
        metadata.links.push({ href, text: text || href })
      }
    })

    // Extract headings
    $("h1, h2, h3, h4, h5, h6").each((i, el) => {
      const level = Number.parseInt(el.tagName.substring(1))
      const text = $(el).text().trim()
      metadata.headings.push({ level, text })
    })

    // Extract images
    $("img").each((i, el) => {
      const src = $(el).attr("src") || ""
      const alt = $(el).attr("alt") || ""
      metadata.images.push({ src, alt })
    })

    // Determine complexity
    const isComplex =
      metadata.hasScripts ||
      metadata.hasStyles ||
      metadata.hasIframes ||
      $("[class]").length > 10 ||
      $("[style]").length > 5 ||
      $("[data-]").length > 0 ||
      html.length > 5000

    metadata.complexity = isComplex ? "complex" : "simple"

    // Return both the parsed data and the original HTML
    return {
      type: "html",
      metadata,
      html: html,
      textContent: $("body").text().trim(),
    }
  } catch (error) {
    console.error("Error parsing HTML:", error)
    return {
      type: "html",
      error: "Failed to parse HTML content",
      html: html,
    }
  }
}

/**
 * Detect if content is likely HTML
 */
export function isHtml(content: string): boolean {
  // Simple check for HTML tags
  return /<[a-z][\s\S]*>/i.test(content)
}

/**
 * Sanitize HTML for safe display
 * This is a simple implementation - consider using DOMPurify in production
 */
export function sanitizeHtml(html: string): string {
  // Basic sanitization - remove script tags and on* attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/on\w+=\w+/gi, "")
}
