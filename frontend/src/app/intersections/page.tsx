"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useTrafficStore } from "@/lib/stores/traffic-store"
import { AlertTriangle, Search, Grid3X3, Map } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import { IntersectionVisual } from "@/components/traffic/intersection-visual"
import { useState } from "react"

export default function IntersectionsPage() {
  const { intersections } = useTrafficStore()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const filteredIntersections = intersections.filter((intersection) => {
    const matchesSearch = intersection.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || intersection.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const gridClasses = viewMode === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"

  return (
    <MainLayout title="Intersections" description="Manage and monitor all traffic intersections">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search intersections..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border p-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-7 px-2"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-7 px-2"
            >
              <Map className="h-4 w-4" />
            </Button>
          </div>
          <Badge variant="outline">{filteredIntersections.length} intersections</Badge>
        </div>
      </div>

      <div className={cn("grid gap-4", gridClasses)}>
        {filteredIntersections.map((intersection) => (
          <Card key={intersection.id} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{intersection.name}</CardTitle>
                <Badge
                  variant={
                    intersection.status === "operational"
                      ? "default"
                      : intersection.status === "warning"
                      ? "secondary"
                      : "destructive"
                  }
                  className="capitalize"
                >
                  <span
                    className={cn(
                      "mr-1.5 inline-block h-2 w-2 rounded-full",
                      intersection.status === "operational"
                        ? "bg-green-500"
                        : intersection.status === "warning"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    )}
                  />
                  {intersection.status}
                </Badge>
              </div>
            </CardHeader>
<CardContent>
               <div className="space-y-3">
                 {/* Mini visual preview */}
                 <div className="flex justify-center">
                   <IntersectionVisual intersection={intersection} size={120} />
                 </div>

                 <div className="flex items-center justify-between">
                   <span className="text-muted-foreground">Vehicles</span>
                   <span className="font-medium">{intersection.vehicleCount}</span>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="text-muted-foreground">Density</span>
                   <span className="font-medium">{Math.round(intersection.density * 100)}%</span>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="text-muted-foreground">Location</span>
                   <span className="font-medium text-xs">
                     {intersection.location.lat.toFixed(4)}, {intersection.location.lng.toFixed(4)}
                   </span>
                 </div>

                {intersection.status !== "operational" && (
                  <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 p-2 text-sm text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400">
                    <AlertTriangle className="h-4 w-4" />
                    {intersection.status === "warning"
                      ? "High traffic detected"
                      : "System requires attention"}
                  </div>
                )}

                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/intersections/${intersection.id}`}>View Details</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </MainLayout>
  )
}