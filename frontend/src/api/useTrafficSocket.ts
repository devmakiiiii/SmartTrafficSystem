import { useEffect, useRef, useState, useCallback } from "react"
import { WS_URL } from "./config"
import { useTrafficStore } from "@/lib/stores/traffic-store"

interface RawIntersection {
  id: string
  name: string
  density: number        // 0–100
  phase: string
  action: string
  vehicle_count: number
  status: string
  lat: number
  lng: number
}

interface TrafficUpdate {
  type: "traffic_update"
  timestamp: string
  intersections: RawIntersection[]
  is_peak: boolean
}

// WebSocket close code to human-readable reason mapping
const closeCodeReason = (code: number): string => {
  const reasons: Record<number, string> = {
    1000: "Normal closure",
    1001: "Going away",
    1002: "Protocol error",
    1003: "Unsupported data",
    1005: "No status received",
    1006: "Abnormal closure (common for network errors)",
    1011: "Internal error",
    1015: "TLS handshake failure",
  }
  return reasons[code] || "Unknown"
}

// WebSocket ready state mapping
const readyStateMap: Record<number, string> = {
  0: "CONNECTING",
  1: "OPEN",
  2: "CLOSING",
  3: "CLOSED",
}

export function useTrafficSocket() {
  const [trafficData, setTrafficData] = useState<TrafficUpdate | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectRef = useRef<(() => void) | null>(null)

  const { setIntersections, updateTrafficMetrics, addTrafficData } = useTrafficStore()
  const setEmergency = useTrafficStore.getState().setEmergency

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    console.log("[WS] Attempting connection to:", WS_URL)
    ws.current = new WebSocket(WS_URL)

    ws.current.onopen = () => {
      setIsConnected(true)
      console.log("[WS] Connected to traffic backend")
    }

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // ─────────────────────────────────────────────
        // NORMAL TRAFFIC UPDATE
        // ─────────────────────────────────────────────
        if (data.type === "traffic_update") {
          setTrafficData(data)

          // Preserve emergencyActive from current store state so WS updates
          // don't wipe out an active emergency flag
          const currentIntersections = useTrafficStore.getState().intersections

          const normalised = data.intersections.map((i: RawIntersection) => {
            const existing = currentIntersections.find((c) => c.id === i.id)

            return {
              id: i.id,
              name: i.name,
              location: {
                lat: i.lat ?? 14.5587,
                lng: i.lng ?? 121.0234,
              },
              density: i.density / 100,
              vehicleCount: i.vehicle_count ?? Math.round(i.density * 4),
              status: (
                i.status ??
                (i.density > 70
                  ? "error"
                  : i.density > 45
                  ? "warning"
                  : "operational")
              ) as "operational" | "warning" | "error",

              // ✅ Preserve emergencyActive across WS refreshes
              emergencyActive: existing?.emergencyActive ?? false,
            }
          })

          setIntersections(normalised)

          const totalVehicles = data.intersections.reduce(
            (sum: number, i: RawIntersection) => sum + (i.vehicle_count ?? 0),
            0
          )

          const avgDensity =
            data.intersections.reduce(
              (sum: number, i: RawIntersection) => sum + i.density,
              0
            ) / (data.intersections.length || 1)

          const congestionLevel = avgDensity / 100

          updateTrafficMetrics({
            totalVehicles,
            congestionLevel,
            averageSpeed: Math.round(60 - congestionLevel * 40),
            waitTime: Math.round(congestionLevel * 90),
          })

          addTrafficData({
            timestamp: data.timestamp,
            totalVehicles,
            congestionLevel,
          })
        }

        // ─────────────────────────────────────────────
        // EMERGENCY ACTIVATED
        // ─────────────────────────────────────────────
        else if (data.type === "emergency_activated") {
          console.log("[WS] Emergency activated:", data)
          setEmergency(data.intersection_id, true)
        }

        // ─────────────────────────────────────────────
        // EMERGENCY CLEARED (auto-revert after 60s)
        // ─────────────────────────────────────────────
        else if (data.type === "emergency_cleared") {
          console.log("[WS] Emergency cleared:", data)
          // Clear all intersections that were on the emergency route
          const ids: string[] = data.intersection_ids ?? []
          ids.forEach((iid: string) => setEmergency(iid, false))
        }

      } catch (err) {
        console.error("[WS] Failed to parse message:", err)
      }
    }

    ws.current.onclose = (event) => {
      setIsConnected(false)
      const reason = event.reason || closeCodeReason(event.code)
      console.log(`[WS] Disconnected (${event.code}: ${reason}) — retrying in 3s`)
      reconnectTimer.current = setTimeout(() => connectRef.current?.(), 3000)
    }

    ws.current.onerror = (event: Event) => {
      // WebSocket onerror receives a generic Event, not an Error object.
      // This typically means the server is unreachable or refused connection.
      const state = ws.current?.readyState ?? -1
      const stateDesc = readyStateMap[state] ?? "UNKNOWN"
      
      console.error("[WS] Connection error - backend may be offline")
      console.error(`[WS] URL: ${WS_URL}`)
      console.error(`[WS] ReadyState: ${state} (${stateDesc})`)
      console.error("[WS] Ensure backend is running: cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000")
      
      ws.current?.close()
    }
  }, [setIntersections, updateTrafficMetrics, addTrafficData, setEmergency])

  // keep a stable ref to the latest connect so closures (eg. onclose) can call it
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [connect])

  const sendEmergency = useCallback((from: string, to: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "emergency", from, to }))
    } else {
      console.warn("[WS] Cannot send — not connected")
    }
  }, [])

  return { trafficData, isConnected, sendEmergency }
}