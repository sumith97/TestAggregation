"use client"

import { useState, useEffect } from "react"
import { Database } from "lucide-react"

export function DbUsageIndicatorFallback() {
  const [itemCount, setItemCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchItemCount = async () => {
      try {
        const response = await fetch("/api/item-count")
        const data = await response.json()
        setItemCount(data.count || 0)
      } catch (err) {
        console.error("Error fetching item count:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchItemCount()

    // Refresh every 5 minutes
    const interval = setInterval(fetchItemCount, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center text-sm text-gray-500">
        <Database className="h-4 w-4 mr-1" />
        <span>{loading ? "Loading..." : `Database Usage`}</span>
      </div>
      <div className="text-xs text-gray-500">{loading ? "..." : `${itemCount} items stored`}</div>
      <div className="text-xs text-gray-500">Free tier: 256MB max</div>
    </div>
  )
}
