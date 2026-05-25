"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Car, Gauge, Activity, Clock } from "lucide-react"
import { useTrafficStore } from "@/lib/stores/traffic-store"
import { cn } from "@/lib/utils"

export default function IntersectionsPage() {
  const { intersections } = useTrafficStore()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="flex h-16 items-center px-4">
          <h1 className="text-lg font-semibold">Smart Traffic System</h1>
          <nav className="ml-auto flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">Dashboard</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/intersections">Intersections</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/analytics">Analytics</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/predictions">Predictions</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings">Settings</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight">Intersections</h2>
            <p className="text-muted-foreground">Manage and monitor all traffic intersections</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {intersections.map((intersection) => (
              <Card key={intersection.id} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{intersection.name}</CardTitle>
                    <Badge
                      variant={
                        intersection.status === "operational"
                          ? "default"
                          : intersection.status === "warning"
                          ? "secondary"
                          : "destructive"
                      }
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
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vehicles</span>
                      <span className="font-medium">{intersection.vehicleCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Density</span>
                      <span className="font-medium">{Math.round(intersection.density * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location</span>
                      <span className="font-medium text-sm">
                        {intersection.location.lat.toFixed(4)}, {intersection.location.lng.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}