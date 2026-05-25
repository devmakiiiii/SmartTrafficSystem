"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, BarChart3, TrendingUp, Clock } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"

const hourlyData = [
  { hour: "6 AM", volume: 120 },
  { hour: "8 AM", volume: 450 },
  { hour: "10 AM", volume: 280 },
  { hour: "12 PM", volume: 320 },
  { hour: "2 PM", volume: 380 },
  { hour: "4 PM", volume: 490 },
  { hour: "6 PM", volume: 520 },
  { hour: "8 PM", volume: 280 },
  { hour: "10 PM", volume: 150 },
]

const weeklyData = [
  { day: "Mon", volume: 12540 },
  { day: "Tue", volume: 13200 },
  { day: "Wed", volume: 11890 },
  { day: "Thu", volume: 14100 },
  { day: "Fri", volume: 15670 },
  { day: "Sat", volume: 9800 },
  { day: "Sun", volume: 8200 },
]

const congestionDistribution = [
  { name: "Low", value: 35, color: "var(--primary)" },
  { name: "Medium", value: 45, color: "var(--warning, oklch(0.75 0.15 60))" },
  { name: "High", value: 20, color: "var(--destructive)" },
]

export default function AnalyticsPage() {
  return (
    <MainLayout title="Analytics" description="Historical traffic patterns and insights">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8:00 AM</div>
            <p className="text-xs text-muted-foreground">Highest traffic volume</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Daily Volume</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,540</div>
            <p className="text-xs text-muted-foreground">Vehicles per day</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trend</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+8.2%</div>
            <p className="text-xs text-muted-foreground">From last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Range</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">30 days</div>
            <Badge variant="outline" className="mt-1">
              Analysis period
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hourly Traffic Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200} aspect={undefined}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Bar dataKey="volume" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Traffic Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200} aspect={undefined}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="volume"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Congestion Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200} aspect={undefined}>
                <PieChart>
                  <Pie
                    data={congestionDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {congestionDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-center gap-6">
              {congestionDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm">
                    {item.name}: {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Peak Traffic Hours</p>
              <p className="text-sm text-muted-foreground">
                Rush hours (7-9 AM & 5-7 PM) show 3x normal traffic volume
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Congestion Hotspots</p>
              <p className="text-sm text-muted-foreground">
                3 intersections consistently show high congestion during peak hours
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Improvement Suggestions</p>
              <p className="text-sm text-muted-foreground">
                Adjusting signal timing could reduce wait times by up to 15%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}