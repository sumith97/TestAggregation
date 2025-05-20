"use client"

import { useState, useEffect } from "react"
import { Database } from "lucide-react"

interface DbStats {
  totalKeys: number
  maxStorage: number
  usedStorage: number
  usedPercentage: number
  isSample?: boolean
  sampleSize?: number
  error?: string
}

export function DbUsageIndicator() {
  const [stats, setStats] = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/db-stats")
        const data = await response.json()

        if (!response.ok || data.error) {
          throw new Error(data.error || "Failed to fetch database stats")
        }

        setStats(data)
        setError(null)
      } catch (err: any) {
        console.error("Error fetching database stats:", err)
        setError(err.message || "Error fetching database stats")
      } finally {
        setLoading(false)
      }
    }

    fetchStats()

    // Refresh stats every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  // Format bytes to human-readable format
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"

    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // Determine color based on usage percentage
  const getColorClass = (percentage: number) => {
    if (percentage < 50) return "text-green-600"
    if (percentage < 80) return "text-yellow-600"
    return "text-red-600"
  }

  if (loading) {
    return (
      <div className="flex items-center text-sm text-gray-500">
        <Database className="h-4 w-4 mr-1" />
        <span>Calculating usage...</span>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-end">
        <div className="flex items-center text-sm text-gray-500">
          <Database className="h-4 w-4 mr-1" />
          <span>Database Usage</span>
        </div>
        <div className="text-xs text-gray-500">{error ? "Error calculating size" : "Unknown usage"}</div>
        <div className="text-xs text-gray-500">{stats?.totalKeys || 0} items stored</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center text-sm">
        <Database className="h-4 w-4 mr-1" />
        <span className={getColorClass(stats.usedPercentage)}>{stats.usedPercentage}% used</span>
      </div>
      <div className="text-xs text-gray-500">
        {formatBytes(stats.usedStorage)} of {formatBytes(stats.maxStorage)}
        {stats.isSample && " (est.)"}
      </div>
      <div className="text-xs text-gray-500">{stats.totalKeys} items stored</div>
    </div>
  )
}
