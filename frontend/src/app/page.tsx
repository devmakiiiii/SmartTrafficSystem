"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Car, Gauge, Activity, Clock, TrendingUp } from "lucide-react"
import { useTrafficStore } from "@/lib/stores/traffic-store"
import { MainLayout } from "@/components/layout/main-layout"
import { cn } from "@/lib/utils"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"

export default function DashboardPage() {
  const { trafficMetrics, trafficHistory, intersections } = useTrafficStore()

  const chartData = trafficHistory.slice(-20).map((item) => ({
    time: new Date(item.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    vehicles: item.vehicleCount,
    speed: item.averageSpeed,
  }))

  const getCongestionColor = (level: number) => {
    if (level < 0.3) return "text-green-500"
    if (level < 0.6) return "text-yellow-500"
    return "text-red-500"
  }

  const getCongestionBg = (level: number) => {
    if (level < 0.3) return "bg-green-500/10"
    if (level < 0.6) return "bg-yellow-500/10"
    return "bg-red-500/10"
  }

  return (
    <MainLayout title="Traffic Dashboard" description="Real-time traffic monitoring and control">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trafficMetrics.totalVehicles.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">+12%</span> from last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Speed</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trafficMetrics.averageSpeed} mph</div>
            <p className="text-xs text-muted-foreground">Normal range (20-30 mph)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Congestion</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", getCongestionColor(trafficMetrics.congestionLevel))}>
              {Math.round(trafficMetrics.congestionLevel * 100)}%
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full transition-all", getCongestionBg(trafficMetrics.congestionLevel))}
                style={{ width: `${trafficMetrics.congestionLevel * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wait Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trafficMetrics.waitTime}s</div>
            <p className="text-xs text-muted-foreground">Average delay</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Traffic Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200} aspect={undefined}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="vehicles"
                      stroke="var(--primary)"
                      fill="var(--primary)"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-muted-foreground">No traffic data yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Active Intersections
              <Badge variant="outline">{intersections.length} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {intersections.slice(0, 4).map((intersection) => (
                <Link
                  key={intersection.id}
                  href={`/intersections/${intersection.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <p className="font-medium">{intersection.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {intersection.vehicleCount} vehicles • {Math.round(intersection.density * 100)}% density
                    </p>
                  </div>
                  <div className="ml-2 flex items-center gap-2">
                    <span className="text-xs font-medium">
                      {Math.round(intersection.density * 100)}%
                    </span>
                    <div
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        intersection.status === "operational"
                          ? "bg-green-500"
                          : intersection.status === "warning"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      )}
                    />
                  </div>
                </Link>
              ))}
              {intersections.length > 4 && (
                <Link href="/intersections" className="block text-center text-sm text-primary hover:underline">
                  View all {intersections.length} intersections
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}