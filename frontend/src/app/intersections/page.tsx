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
import { useState, useEffect, useRef } from "react"

// ── Types ─────────────────────────────────────────────────────

type SignalPhase = "green" | "yellow" | "red"

interface SignalState {
  phase: SignalPhase
  remaining: number   // seconds left in current phase
  greenDuration: number
  yellowDuration: number
  redDuration: number
}

// ── Adaptive signal timing ────────────────────────────────────
// Green duration scales with density; each intersection gets a
// phase offset so they don't all flip simultaneously.

function calcGreenDuration(density: number): number {
  // density is 0–1 from the store
  if (density > 0.75) return 60
  if (density > 0.50) return 45
  if (density > 0.25) return 30
  return 20
}

const YELLOW_DURATION = 4   // fixed yellow
// Red = total cycle - green - yellow (minimum 15s)
function calcRedDuration(green: number): number {
  return Math.max(15, Math.round(green * 0.8))
}

// Build initial signal state for each intersection with a staggered offset
// so no two intersections start at the same point in their cycle.
function buildInitialSignal(density: number, offsetSeconds: number): SignalState {
  const green  = calcGreenDuration(density)
  const yellow = YELLOW_DURATION
  const red    = calcRedDuration(green)
  const cycle  = green + yellow + red

  // Wrap offset into cycle
  const pos = offsetSeconds % cycle

  if (pos < green) {
    return { phase: "green",  remaining: green - pos,  greenDuration: green, yellowDuration: yellow, redDuration: red }
  } else if (pos < green + yellow) {
    return { phase: "yellow", remaining: green + yellow - pos, greenDuration: green, yellowDuration: yellow, redDuration: red }
  } else {
    return { phase: "red",    remaining: cycle - pos,  greenDuration: green, yellowDuration: yellow, redDuration: red }
  }
}

// ── Hook: per-intersection signal clock ───────────────────────

function useSignalClocks(intersectionIds: string[], densities: Record<string, number>) {
  const [signals, setSignals] = useState<Record<string, SignalState>>({})
  const initialized = useRef(false)

  // Initialise once when intersection list first arrives
  useEffect(() => {
    if (intersectionIds.length === 0) return
    if (initialized.current) return
    initialized.current = true

    const initial: Record<string, SignalState> = {}
    intersectionIds.forEach((id, idx) => {
      // Each intersection gets a unique offset (spread evenly across a 90s window)
      // so they cycle independently and never all flip at once.
      const offset = idx * 15   // 15-second stagger between intersections
      initial[id] = buildInitialSignal(densities[id] ?? 0, offset)
    })
    setSignals(initial)
  }, [intersectionIds, densities])

  // Tick every second
  useEffect(() => {
    if (Object.keys(signals).length === 0) return

    const timer = setInterval(() => {
      setSignals((prev) => {
        const next: Record<string, SignalState> = {}

        for (const id of Object.keys(prev)) {
          const s = prev[id]
          const newRemaining = s.remaining - 1

          if (newRemaining > 0) {
            next[id] = { ...s, remaining: newRemaining }
          } else {
            // Advance to next phase; recalculate green adaptively on each new green
            if (s.phase === "green") {
              next[id] = { ...s, phase: "yellow", remaining: s.yellowDuration }
            } else if (s.phase === "yellow") {
              next[id] = { ...s, phase: "red", remaining: s.redDuration }
            } else {
              // Back to green — recalculate duration from latest density
              const newGreen = calcGreenDuration(densities[id] ?? 0)
              const newRed   = calcRedDuration(newGreen)
              next[id] = {
                phase: "green",
                remaining: newGreen,
                greenDuration: newGreen,
                yellowDuration: YELLOW_DURATION,
                redDuration: newRed,
              }
            }
          }
        }
        return next
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [signals, densities])

  return signals
}

// ── Mini traffic light component ──────────────────────────────

function TrafficLight({ phase, remaining, greenDuration }: {
  phase: SignalPhase
  remaining: number
  greenDuration: number
}) {
  const pct = phase === "green"
    ? (remaining / greenDuration) * 100
    : 100

  return (
    <div className="flex items-center gap-3">
      {/* Light stack */}
      <div className="flex flex-col items-center gap-1 rounded-lg bg-zinc-900 px-2 py-2 border border-zinc-700">
        {/* Red */}
        <div className={cn(
          "h-4 w-4 rounded-full border transition-all duration-300",
          phase === "red"
            ? "bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.7)] border-red-400"
            : "bg-zinc-700 border-zinc-600"
        )} />
        {/* Yellow */}
        <div className={cn(
          "h-4 w-4 rounded-full border transition-all duration-300",
          phase === "yellow"
            ? "bg-yellow-400 shadow-[0_0_8px_2px_rgba(250,204,21,0.7)] border-yellow-300"
            : "bg-zinc-700 border-zinc-600"
        )} />
        {/* Green */}
        <div className={cn(
          "h-4 w-4 rounded-full border transition-all duration-300",
          phase === "green"
            ? "bg-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.7)] border-green-400"
            : "bg-zinc-700 border-zinc-600"
        )} />
      </div>

      {/* Phase info */}
      <div className="flex flex-col gap-0.5">
        <span className={cn(
          "text-sm font-semibold capitalize",
          phase === "green"  && "text-green-500",
          phase === "yellow" && "text-yellow-400",
          phase === "red"    && "text-red-500",
        )}>
          {phase}
        </span>
        <span className="text-xs text-muted-foreground">
          {remaining}s remaining
        </span>
        {/* Countdown bar */}
        <div className="h-1 w-20 rounded-full bg-zinc-700 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              phase === "green"  && "bg-green-500",
              phase === "yellow" && "bg-yellow-400",
              phase === "red"    && "bg-red-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function IntersectionsPage() {
  const { intersections } = useTrafficStore()
  const [searchTerm, setSearchTerm]     = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode]         = useState<"grid" | "list">("grid")

  const filteredIntersections = intersections.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || i.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Build density map for the signal hook
  const densityMap: Record<string, number> = {}
  intersections.forEach((i) => { densityMap[i.id] = i.density })

  const intersectionIds = intersections.map((i) => i.id)
  const signals = useSignalClocks(intersectionIds, densityMap)

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
        {filteredIntersections.map((intersection) => {
          const signal = signals[intersection.id]

          return (
            <Card key={intersection.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{intersection.name}</CardTitle>
                  <Badge
                    variant={
                      intersection.status === "operational" ? "default"
                      : intersection.status === "warning"   ? "secondary"
                      : "destructive"
                    }
                    className="capitalize"
                  >
                    <span className={cn(
                      "mr-1.5 inline-block h-2 w-2 rounded-full",
                      intersection.status === "operational" ? "bg-green-500"
                      : intersection.status === "warning"   ? "bg-yellow-500"
                      : "bg-red-500"
                    )} />
                    {intersection.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {/* Intersection visual */}
                  <div className="flex justify-center">
                    <IntersectionVisual intersection={intersection} size={120} />
                  </div>

                  {/* ── Adaptive traffic light ── */}
                  {signal ? (
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      <TrafficLight
                        phase={signal.phase}
                        remaining={signal.remaining}
                        greenDuration={signal.greenDuration}
                      />
                      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-xs text-muted-foreground">
                        <span>🟢 {signal.greenDuration}s</span>
                        <span>🟡 {signal.yellowDuration}s</span>
                        <span>🔴 {signal.redDuration}s</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-16 rounded-lg border bg-muted/20 animate-pulse" />
                  )}

                  {/* Stats */}
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
          )
        })}
      </div>
    </MainLayout>
  )
}