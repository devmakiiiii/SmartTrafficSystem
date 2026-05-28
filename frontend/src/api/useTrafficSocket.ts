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
                lat: i.lat ?? 14.8527,
                lng: i.lng ?? 120.8114,
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

    ws.current.onclose = () => {
      setIsConnected(false)
      console.log("[WS] Disconnected — retrying in 3s")
      reconnectTimer.current = setTimeout(() => connectRef.current?.(), 3000)
    }

    ws.current.onerror = (err) => {
      console.error("[WS] Error:", err)
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