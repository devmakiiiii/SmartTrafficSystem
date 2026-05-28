"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, MapPin, TrendingUp, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MainLayout } from "@/components/layout/main-layout"
import Link from "next/link"
import { useTrafficStore } from "@/lib/stores/traffic-store"
import { predictCongestion, getBayesianEstimate } from "@/api/trafficApi"

// ── Types ────────────────────────────────────────────────────

interface MLPrediction {
  label: "none" | "low" | "medium" | "high"
  confidence: number
  explanation: string
  probabilities: Record<string, number>
  inputs: {
    hour: number
    day: string
    vehicle_count: number
    weather: string
    density_pct: number
  }
}

interface BayesResult {
  p_congestion: number
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  evidence_used: string[]
  explanation: string
}

// ── Helpers ──────────────────────────────────────────────────

function getCurrentDayOfWeek(): number {
  // Python/backend: 0=Monday … 6=Sunday
  // JS getDay():    0=Sunday … 6=Saturday
  const jsDay = new Date().getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

function getPeakLabel(hour: number): string {
  if (hour >= 7 && hour <= 9)   return "Morning Rush"
  if (hour >= 12 && hour <= 13) return "Lunch Hour"
  if (hour >= 17 && hour <= 19) return "Evening Rush"
  if (hour >= 20 || hour <= 5)  return "Night / Low Traffic"
  return "Off-Peak"
}

function getPeakTime(hour: number): string {
  if (hour < 9)  return "7–9 AM"
  if (hour < 14) return "12–1 PM"
  if (hour < 20) return "5–7 PM"
  return "8 PM–6 AM"
}

function confidencePct(confidence: number): number {
  return Math.round(confidence * 100)
}

function labelColor(label: string): "default" | "secondary" | "destructive" | "outline" {
  if (label === "high")   return "destructive"
  if (label === "medium") return "secondary"
  if (label === "low")    return "outline"
  return "default"
}

function riskColor(risk: string): "default" | "secondary" | "destructive" | "outline" {
  if (risk === "CRITICAL") return "destructive"
  if (risk === "HIGH")     return "destructive"
  if (risk === "MEDIUM")   return "secondary"
  return "default"
}

// ── Component ────────────────────────────────────────────────

export default function PredictionsPage() {
  const { intersections } = useTrafficStore()

  const [prediction, setPrediction]   = useState<MLPrediction | null>(null)
  const [bayesResult, setBayesResult] = useState<BayesResult | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>("")

  // Derive risk intersections from live store data
  const riskIntersections = [...intersections]
    .sort((a, b) => b.density - a.density)
    .slice(0, 5)
    .map((i) => ({
      id:     i.id,
      name:   i.name,
      risk:   i.density > 0.7 ? "High" : i.density > 0.45 ? "Medium" : "Low",
      factor: i.density > 0.7
        ? "Heavy congestion"
        : i.density > 0.45
        ? "Moderate traffic"
        : "Normal flow",
      density: i.density,
    }))

  // Derive recommendations from risk intersections
  const recommendations = riskIntersections
    .filter((i) => i.risk !== "Low")
    .map((i, idx) => ({
      id:           idx + 1,
      intersection: i.name,
      action:       i.risk === "High"
        ? "Extend green signal duration"
        : "Monitor and pre-emptively adjust",
      impact: i.risk === "High"
        ? "Reduce wait time by ~25%"
        : "Handle 15% more flow",
      priority: i.risk === "High" ? "high" : "medium",
    }))

  // ── Fetch ML prediction + Bayesian estimate ───────────────

  async function fetchPredictions() {
    setLoading(true)
    setError(null)

    try {
      const hour          = new Date().getHours()
      const dayOfWeek     = getCurrentDayOfWeek()
      const totalVehicles = intersections.reduce((s, i) => s + i.vehicleCount, 0)
      const avgVehicles   = Math.round(
        totalVehicles / Math.max(intersections.length, 1)
      )
      const avgDensity    = intersections.length > 0
        ? intersections.reduce((s, i) => s + i.density, 0) / intersections.length
        : 0
      const isPeak        = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)

      // Run both requests in parallel
      const [mlRes, bayesRes] = await Promise.all([
        predictCongestion({
          hour,
          day_of_week:   dayOfWeek,
          vehicle_count: avgVehicles,
          weather:       0,   // clear — extend later with a weather selector
          is_holiday:    0,
          temperature:   28,
        }),
        getBayesianEstimate({
          peak_hour:    isPeak,
          high_density: avgDensity > 0.7,
          rain:         false,
          accident:     false,
          fog:          false,
          weekend:      dayOfWeek >= 5,
        }),
      ])

      if (mlRes.label)            setPrediction(mlRes as MLPrediction)
      if (bayesRes.p_congestion !== undefined) setBayesResult(bayesRes as BayesResult)

      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      setError("Could not reach backend. Make sure the server is running on port 8000.")
      console.error("[Predictions]", err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount and whenever intersections update
  useEffect(() => {
    async function loadPredictions() {
      await fetchPredictions()
    }

    loadPredictions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intersections.length])

  // ── Render ────────────────────────────────────────────────

  const hour           = new Date().getHours()
  const peakLabel      = getPeakLabel(hour)
  const peakTime       = getPeakTime(hour)
  const confidenceVal  = prediction ? confidencePct(prediction.confidence) : 0

  return (
    <MainLayout
      title="Predictions"
      description="AI congestion forecasts powered by Random Forest ML + Bayesian inference"
    >
      {/* ── Error banner ── */}
      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <Button size="sm" variant="outline" onClick={fetchPredictions}>
            Retry
          </Button>
        </div>
      )}

      {/* ── Top row ── */}
      <div className="grid gap-6 md:grid-cols-3">

        {/* ML Prediction card */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              ML Congestion Forecast
            </CardTitle>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="text-xs text-muted-foreground">
                  Updated {lastUpdated}
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={fetchPredictions}
                disabled={loading}
                className="h-7 w-7 p-0"
              >
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />
                }
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading && !prediction ? (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Running Random Forest model…</span>
              </div>
            ) : prediction ? (
              <>
                {/* Predicted label */}
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-bold capitalize">
                    {prediction.label}
                  </div>
                  <Badge variant={labelColor(prediction.label)} className="text-base capitalize">
                    {prediction.label} congestion
                  </Badge>
                </div>

                {/* Explanation from backend */}
                <p className="text-sm text-muted-foreground">
                  {prediction.explanation}
                </p>

                {/* Confidence bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Model Confidence</span>
                    <span className="font-medium">{confidenceVal}%</span>
                  </div>
                  <Progress value={confidenceVal} className="h-2" />
                </div>

                {/* Probability breakdown */}
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Probability breakdown
                  </p>
                  {Object.entries(prediction.probabilities).map(([lbl, prob]) => (
                    <div key={lbl} className="flex items-center gap-3 text-sm">
                      <span className="w-16 capitalize text-muted-foreground">{lbl}</span>
                      <div className="flex-1">
                        <Progress value={Math.round(prob * 100)} className="h-1.5" />
                      </div>
                      <span className="w-10 text-right font-mono text-xs">
                        {Math.round(prob * 100)}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* Input summary */}
                {prediction.inputs && (
                  <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Model inputs</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <span>Hour: <strong>{prediction.inputs.hour}:00</strong></span>
                      <span>Day: <strong>{prediction.inputs.day}</strong></span>
                      <span>Vehicles: <strong>{prediction.inputs.vehicle_count}</strong></span>
                      <span>Weather: <strong>{prediction.inputs.weather}</strong></span>
                      <span>Density: <strong>{prediction.inputs.density_pct}%</strong></span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No prediction data yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Next 24-hour schedule */}
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
              <Badge variant={hour >= 7 && hour <= 9 ? "secondary" : "outline"}>
                7–9 AM
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Midday Flow</span>
              <Badge variant={hour >= 9 && hour < 17 ? "secondary" : "outline"}>
                9 AM–4 PM
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Evening Rush</span>
              <Badge variant={hour >= 17 && hour <= 19 ? "secondary" : "outline"}>
                4–7 PM
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Low Traffic</span>
              <Badge variant={hour >= 20 || hour <= 5 ? "secondary" : "outline"}>
                7 PM–7 AM
              </Badge>
            </div>

            {/* Current period highlight */}
            <div className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
              <p className="font-medium text-primary">{peakLabel}</p>
              <p className="text-xs text-muted-foreground">Current period: {peakTime}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bayesian estimate ── */}
      {bayesResult && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Bayesian Uncertainty Estimate
              <Badge variant={riskColor(bayesResult.risk_level)}>
                {bayesResult.risk_level} Risk
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold">
                {Math.round(bayesResult.p_congestion * 100)}%
              </div>
              <p className="text-sm text-muted-foreground">
                P(Congestion | Evidence) — probability of congestion given current signals
              </p>
            </div>
            <Progress value={Math.round(bayesResult.p_congestion * 100)} className="h-2" />
            <p className="text-xs text-muted-foreground">{bayesResult.explanation}</p>
            {bayesResult.evidence_used.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">Active signals:</span>
                {bayesResult.evidence_used.map((e) => (
                  <Badge key={e} variant="outline" className="text-xs capitalize">
                    {e.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Risk areas + recommendations ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">

        {/* Risk areas — live from store */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Risk Areas
              <Badge variant="destructive">
                {riskIntersections.filter((i) => i.risk === "High").length} High Risk
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {riskIntersections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Waiting for live intersection data…
              </p>
            ) : (
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
                        <p className="text-xs text-muted-foreground">
                          {item.factor} · {Math.round(item.density * 100)}% density
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        item.risk === "High"
                          ? "destructive"
                          : item.risk === "Medium"
                          ? "secondary"
                          : "default"
                      }
                    >
                      {item.risk}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommended actions — derived from live data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recommended Actions
              <Badge>{recommendations.length} pending</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No actions needed — traffic is flowing normally.
              </p>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{rec.intersection}</p>
                        <Badge
                          variant={rec.priority === "high" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.action}</p>
                      <p className="text-xs text-green-500">{rec.impact}</p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-primary" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}