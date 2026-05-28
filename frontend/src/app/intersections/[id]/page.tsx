"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft,
  Activity,
  Car,
  Timer,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Siren,
} from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import { IntersectionVisual } from "@/components/traffic/intersection-visual"
import { useTrafficStore } from "@/lib/stores/traffic-store"
import { optimizeSignal, activateEmergency, getRoute } from "@/api/trafficApi"
import { cn } from "@/lib/utils"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

// ── Types ────────────────────────────────────────────────────

interface SignalOptimizeResult {
  green_duration_s: number
  actions: string[]
  reasoning_trace: { rule_id: string; matched: boolean; explanation: string }[]
  explanation: string
  p_congestion?: number
  risk_level?: string
}

interface RouteResult {
  primary: {
    path: string[]
    path_names: string[]
    cost_minutes: number
    algorithm: string
  }
  comparison: Record<string, { path: string[]; path_names: string[]; cost_minutes: number }>
}

// ── Helpers ──────────────────────────────────────────────────

function signalColor(phase: string) {
  if (phase === "green")  return "bg-green-500"
  if (phase === "yellow") return "bg-yellow-500"
  return "bg-red-500"
}

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "operational") return "default"
  if (status === "warning")     return "secondary"
  return "destructive"
}

// ── Component ────────────────────────────────────────────────

export default function IntersectionDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const id       = params?.id as string

  const { intersections } = useTrafficStore()
  const intersection = intersections.find((i) => i.id === id)

  // Density history for the mini chart (last 20 WS ticks)
  const [densityHistory, setDensityHistory] = useState<{ time: string; density: number }[]>([])

  // AI panel state
  const [signalResult,     setSignalResult]     = useState<SignalOptimizeResult | null>(null)
  const [routeResult,      setRouteResult]       = useState<RouteResult | null>(null)
  const [aiLoading,        setAiLoading]         = useState(false)
  const [emergencyLoading, setEmergencyLoading]  = useState(false)
  const [emergencyDone,    setEmergencyDone]     = useState(false)
  const [aiError,          setAiError]           = useState<string | null>(null)

  // Track density over time
  useEffect(() => {
    if (!intersection) return
    const timer = window.setTimeout(() => {
      setDensityHistory((prev) => {
        const point = {
          time:    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          density: Math.round(intersection.density * 100),
        }
        const next = [...prev, point]
        return next.slice(-20)   // keep last 20 snapshots
      })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [intersection])

  // ── AI: signal optimization ──────────────────────────────

  const runSignalOptimize = useCallback(async (forceEmergency?: boolean) => {
    // ✅ Read FRESH intersection from store — avoids stale closure
    //    so emergency flag is always current on first click
    const fresh = useTrafficStore.getState().intersections.find((i) => i.id === id)
    if (!fresh) return
    setAiLoading(true)
    setAiError(null)
    try {
      const isEmergency = forceEmergency ?? !!fresh.emergencyActive

      const res = await optimizeSignal({
        intersection_id: fresh.id,
        density:         Math.round(fresh.density * 100),
        weather:         "clear",
        emergency:       isEmergency,
        is_peak:         (() => {
          const h = new Date().getHours()
          return (h >= 7 && h <= 9) || (h >= 17 && h <= 19)
        })(),
      })
      setSignalResult(res)
    } catch {
      setAiError("Could not reach backend. Is the server running on port 8000?")
    } finally {
      setAiLoading(false)
    }
  }, [id])  // ✅ depends only on stable id — no stale closure

  // ── AI: route recommendation from this intersection ──────

  const runRouteRecommend = useCallback(async () => {
    if (!intersection || intersections.length < 2) return
    setAiLoading(true)
    setAiError(null)
    try {
      // Route to the intersection with the highest ID (arbitrary "destination")
      const others = intersections.filter((i) => i.id !== intersection.id)
      const goal   = others[others.length - 1].id
      const res    = await getRoute(intersection.id, goal, "astar")
      setRouteResult(res)
    } catch {
      setAiError("Route request failed.")
    } finally {
      setAiLoading(false)
    }
  }, [intersection, intersections])

  // ── Emergency activation ─────────────────────────────────

  const handleEmergency = useCallback(async () => {
    if (!intersection || intersections.length < 2) return
    setEmergencyLoading(true)
    setAiError(null)
    try {
      const others = intersections.filter((i) => i.id !== intersection.id)
      const goal   = others[others.length - 1].id
      await activateEmergency({
        vehicle_type:      "ambulance",
        from_intersection: intersection.id,
        to_intersection:   goal,
      })
      setEmergencyDone(true)
      setTimeout(() => setEmergencyDone(false), 5000)

      // ✅ Auto re-run signal optimization with emergency:true so the
      //    recommended green duration updates immediately
      runSignalOptimize(true)
    } catch {
      setAiError("Emergency activation failed.")
    } finally {
      setEmergencyLoading(false)
    }
  }, [intersection, intersections, runSignalOptimize])  // runSignalOptimize is stable (deps: [id])

  // Auto-run signal optimization on load
  useEffect(() => {
    if (intersection) {
      const t = setTimeout(() => runSignalOptimize(), 0)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intersection?.id])

  // ── Re-run optimization whenever emergencyActive flips ───
  useEffect(() => {
    if (!intersection?.emergencyActive) return
    // Defer to next macrotask to avoid calling setState synchronously
    // inside an effect body (which causes cascading renders).
    const t = setTimeout(() => runSignalOptimize(true), 0)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intersection?.emergencyActive])

  // ── Not found ────────────────────────────────────────────

  if (!intersection) {
    return (
      <MainLayout title="Intersection" description="">
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="text-lg font-semibold">Intersection not found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {id} hasn&apos;t appeared in live data yet. Make sure the backend is running.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/intersections">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to intersections
            </Link>
          </Button>
        </div>
      </MainLayout>
    )
  }

  const densityPct = Math.round(intersection.density * 100)

  // ── Render ───────────────────────────────────────────────

  return (
    <MainLayout
      title={intersection.name}
      description={`Live details for intersection ${intersection.id}`}
    >
      {/* Back + emergency row */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(intersection.status)} className="capitalize">
            <span
              className={cn(
                "mr-1.5 inline-block h-2 w-2 rounded-full",
                intersection.status === "operational" ? "bg-green-500"
                  : intersection.status === "warning"   ? "bg-yellow-500"
                  : "bg-red-500"
              )}
            />
            {intersection.status}
            {intersection.emergencyActive && (
              <Badge variant="destructive" className="ml-2 animate-pulse">
                EMERGENCY
              </Badge>
            )}
          </Badge>

          <Button
            size="sm"
            variant="destructive"
            onClick={handleEmergency}
            disabled={emergencyLoading}
          >
            {emergencyLoading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Siren className="mr-2 h-4 w-4" />
            }
            {emergencyDone ? "Emergency Activated!" : "Activate Emergency"}
          </Button>
        </div>
      </div>

      {/* Visual Intersection */}
      <div className="mb-6 flex justify-center">
        <IntersectionVisual intersection={intersection} />
      </div>

      {/* Emergency banner */}
      {intersection.emergencyActive && (
        <div className="mb-4 rounded-lg border border-red-500 bg-red-500/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <Siren className="h-5 w-5 text-red-500 animate-pulse" />
            <div>
              <p className="font-semibold text-red-500">
                Emergency Vehicle Priority Active
              </p>
              <p className="text-sm text-red-400">
                Traffic signals are being overridden for emergency routing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {aiError && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {aiError}
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vehicle Count</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{intersection.vehicleCount}</div>
            <p className="text-xs text-muted-foreground">vehicles at intersection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Density</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                densityPct > 70 ? "text-red-500"
                  : densityPct > 45 ? "text-yellow-500"
                  : "text-green-500"
              )}
            >
              {densityPct}%
            </div>
            <Progress value={densityPct} className="mt-1 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Signal Phase</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={cn(
                "h-4 w-4 rounded-full",
                signalColor(
                  intersection.emergencyActive
                    ? "green"
                    : densityPct > 50
                    ? "green"
                    : "red"
                )
              )} />
              <span className="text-2xl font-bold capitalize">
                {intersection.emergencyActive
                  ? "Emergency Green"
                  : densityPct > 50
                  ? "Green"
                  : "Red"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {/* ✅ Show live updated timing from signal result */}
              AI recommended:{" "}
              {aiLoading
                ? <span className="animate-pulse">…</span>
                : <strong>{signalResult?.green_duration_s ?? "—"}s green</strong>
              }
              {intersection.emergencyActive && (
                <span className="ml-1 text-red-400 font-medium">(emergency override)</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-mono font-bold">
              {intersection.location.lat.toFixed(4)},
            </div>
            <div className="text-sm font-mono font-bold">
              {intersection.location.lng.toFixed(4)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">GPS coordinates</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Density chart + AI signal panel ── */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">

        {/* Density over time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Density Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {densityHistory.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={densityHistory}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} unit="%" className="text-xs" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                      }}
                      formatter={(v) => [`${v ?? 0}%`, "Density"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="density"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Collecting data… (updates every 3s)
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI signal optimization result */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">AI Signal Optimization</CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => runSignalOptimize()}
              disabled={aiLoading}
              className="h-7 w-7 p-0"
            >
              {aiLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />
              }
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {signalResult ? (
              <>
                {/* Green duration */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "text-4xl font-bold",
                    intersection.emergencyActive ? "text-red-500" : "text-green-500"
                  )}>
                    {signalResult.green_duration_s}s
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Recommended green
                      {intersection.emergencyActive && (
                        <span className="ml-2 text-xs text-red-400 font-normal">(emergency mode)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {signalResult.explanation}
                    </p>
                  </div>
                </div>

                {/* Actions fired */}
                <div className="flex flex-wrap gap-2">
                  {signalResult.actions.map((a) => (
                    <Badge key={a} variant="outline" className="text-xs font-mono">
                      {a}
                    </Badge>
                  ))}
                </div>

                {/* Reasoning trace */}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Inference reasoning trace
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {signalResult.reasoning_trace.map((step) => (
                      <div
                        key={step.rule_id}
                        className={cn(
                          "flex items-start gap-2 rounded px-2 py-1 text-xs",
                          step.matched
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {step.matched
                          ? <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0" />
                          : <span className="mt-0.5 h-3 w-3 flex-shrink-0 text-center">○</span>
                        }
                        <span>
                          <strong>[{step.rule_id}]</strong> {step.explanation}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : aiLoading ? (
              <div className="flex items-center gap-3 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running inference engine…
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Route recommendation ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Route Recommendation from This Intersection</CardTitle>
          <Button size="sm" variant="outline" onClick={runRouteRecommend} disabled={aiLoading}>
            {aiLoading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : null
            }
            Find Route
          </Button>
        </CardHeader>
        <CardContent>
          {routeResult ? (
            <div className="space-y-4">
              {/* Primary route */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Optimal path ({routeResult.primary.algorithm?.toUpperCase()})
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {routeResult.primary.path_names?.map((name, i) => (
                    <span key={i} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{name}</Badge>
                      {i < routeResult.primary.path_names.length - 1 && (
                        <span className="text-muted-foreground">→</span>
                      )}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Estimated travel time: <strong>{routeResult.primary.cost_minutes} min</strong>
                  {" "}(congestion-weighted)
                </p>
              </div>

              {/* Algorithm comparison */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Algorithm comparison
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(routeResult.comparison).map(([algo, result]) => (
                    <div
                      key={algo}
                      className="rounded-lg border p-3 text-center"
                    >
                      <p className="text-xs font-mono font-bold uppercase">{algo}</p>
                      <p className="text-lg font-bold mt-1">
                        {typeof result.cost_minutes === "number"
                          ? `${result.cost_minutes}m`
                          : "—"
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {result.path?.length ?? 0} stops
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click &quot;Find Route&quot; to run Dijkstra, A*, and BFS from this intersection.
            </p>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  )
}