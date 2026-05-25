"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, MapPin, TrendingUp, CheckCircle2 } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import Link from "next/link"

const riskIntersections = [
  { id: "int-004", name: "7th Ave & 34th St", risk: "High", factor: "Signal malfunction" },
  { id: "int-003", name: "Park Ave & 42nd St", risk: "Medium", factor: "Peak traffic" },
  { id: "int-001", name: "Main St & Oak Ave", risk: "Low", factor: "Normal flow" },
]

const recommendations = [
  {
    id: 1,
    intersection: "7th Ave & 34th St",
    action: "Adjust signal timing",
    impact: "Reduce wait time by 25%",
    priority: "high",
  },
  {
    id: 2,
    intersection: "Park Ave & 42nd St",
    action: "Increase green phase",
    impact: "Handle 20% more flow",
    priority: "medium",
  },
  {
    id: 3,
    intersection: "Broadway & 5th Street",
    action: "Enable adaptive mode",
    impact: "Optimize for real-time traffic",
    priority: "medium",
  },
]

export default function PredictionsPage() {
  return (
    <MainLayout title="Predictions" description="Congestion forecasts and risk analysis">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Peak Forecast
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold">2:30 PM</div>
              <Badge variant="outline" className="text-base">
                Today
              </Badge>
            </div>
            <p className="text-muted-foreground">Expected highest congestion based on historical patterns</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Confidence Level</span>
                <span className="font-medium">87%</span>
              </div>
              <Progress value={87} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Next 24 Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Morning Rush</span>
              <Badge variant="secondary">7-9 AM</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Midday Flow</span>
              <Badge variant="outline">9 AM-4 PM</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Evening Rush</span>
              <Badge variant="secondary">4-7 PM</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Low Traffic</span>
              <Badge variant="outline">7 PM-7 AM</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Risk Areas
              <Badge variant="destructive">3 High Risk</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {riskIntersections.map((item) => (
                <Link
                  key={item.id}
                  href={`/intersections/${item.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.factor}</p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      item.risk === "High" ? "destructive" : item.risk === "Medium" ? "secondary" : "default"
                    }
                  >
                    {item.risk}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recommended Actions
              <Badge>{recommendations.length} pending</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <div key={rec.id} className="flex items-start justify-between rounded-lg border p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{rec.intersection}</p>
                      <Badge variant={rec.priority === "high" ? "destructive" : "secondary"} className="text-xs">
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.action}</p>
                    <p className="text-xs text-green-500">{rec.impact}</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground hover:text-primary cursor-pointer" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}