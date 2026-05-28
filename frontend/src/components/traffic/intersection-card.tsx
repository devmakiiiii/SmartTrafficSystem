"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useTrafficStore } from "@/lib/stores/traffic-store"
import type { Intersection } from "@/lib/stores/traffic-store"

export function IntersectionCard({ intersection }: { intersection: Intersection }) {
  const { setSelectedIntersection } = useTrafficStore()

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-green-500"
      case "warning":
        return "bg-yellow-500"
      case "error":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{intersection.name}</CardTitle>
          <Badge variant={intersection.status === "operational" ? "default" : "destructive"}>
            <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", getStatusColor(intersection.status))} />
            {intersection.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Vehicles</span>
            <span className="font-medium">{intersection.vehicleCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Density</span>
            <span className="font-medium">{Math.round(intersection.density * 100)}%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Location</span>
            <span className="font-medium">
              {intersection.location.lat.toFixed(4)}, {intersection.location.lng.toFixed(4)}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            asChild
            onClick={() => setSelectedIntersection(intersection)}
          >
            <Link href={`/intersections/${intersection.id}`}>View Details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}