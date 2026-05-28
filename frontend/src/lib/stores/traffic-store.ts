import { create } from "zustand"
import { devtools } from "zustand/middleware"

// ── Types ──────────────────────────────────────────────────────────────────

export interface Intersection {
  emergencyActive: boolean
  id: string
  name: string
  location: { lat: number; lng: number }
  status: "operational" | "warning" | "error"
  vehicleCount: number
  density: number

  emergency?: boolean

  signalTiming?: {
    north: number
    south: number
    east: number
    west: number
  }
}

export interface TrafficMetrics {
  totalVehicles: number
  averageSpeed: number
  congestionLevel: number                       // 0–1
  waitTime: number
  emergencyVehicles: number
}

export interface TrafficData {
  timestamp: string
  totalVehicles: number
  congestionLevel: number
}

// ── Store ──────────────────────────────────────────────────────────────────

interface TrafficState {
  intersections: Intersection[]
  selectedIntersection: Intersection | null
  trafficMetrics: TrafficMetrics
  trafficHistory: TrafficData[]
  isDarkMode: boolean

  setIntersections: (intersections: Intersection[]) => void
  setSelectedIntersection: (intersection: Intersection | null) => void
  updateTrafficMetrics: (metrics: Partial<TrafficMetrics>) => void
  addTrafficData: (data: TrafficData) => void
  toggleDarkMode: () => void
  setEmergency: (id: string, active: boolean) => void
  updateIntersection: (id: string, updates: Partial<Intersection>) => void
}

export const useTrafficStore = create<TrafficState>()(
  devtools(
    (set) => ({
      // Seed data — gets overwritten once the WebSocket connects
      intersections: [
        {
          id: "I1",
          name: "Intersection 1",
          location: { lat: 14.8527, lng: 120.8114 },
          status: "operational",
          vehicleCount: 127,
          density: 0.35,
          emergencyActive: false,
        },
        {
          id: "I2",
          name: "Intersection 2",
          location: { lat: 14.8535, lng: 120.8122 },
          status: "warning",
          vehicleCount: 200,
          density: 0.55,
          emergencyActive: false,
        },
        {
          id: "I3",
          name: "Intersection 3",
          location: { lat: 14.8543, lng: 120.813 },
          status: "operational",
          vehicleCount: 80,
          density: 0.25,
          emergencyActive: false,
        },
      ],
      selectedIntersection: null,
      trafficMetrics: {
        totalVehicles: 0,
        averageSpeed: 40,
        congestionLevel: 0,
        waitTime: 0,
        emergencyVehicles: 0,
      },
      trafficHistory: [],
      isDarkMode: false,

      setIntersections: (intersections) => set({ intersections }),
      setSelectedIntersection: (intersection) =>
        set({ selectedIntersection: intersection }),
      updateTrafficMetrics: (metrics) =>
        set((state) => ({
          trafficMetrics: { ...state.trafficMetrics, ...metrics },
        })),
      addTrafficData: (data) =>
        set((state) => ({
          // Keep last 50 data points for the chart
          trafficHistory: [...state.trafficHistory.slice(-49), data],
        })),
      toggleDarkMode: () =>
        set((state) => ({
          isDarkMode: !state.isDarkMode,
        })),

      // ✅ FIX: set emergencyActive (not just emergency) so page.tsx reads correctly
      setEmergency: (id, active) =>
        set((state) => ({
          intersections: state.intersections.map((intersection) =>
            intersection.id === id
              ? {
                  ...intersection,
                  emergencyActive: active,          // ✅ field page.tsx checks
                  emergency: active,                // keep for backward compat
                  status: active ? "error" : intersection.status,
                }
              : intersection
          ),
        })),

      updateIntersection: (id, updates) =>
        set((state) => ({
          intersections: state.intersections.map((intersection) =>
            intersection.id === id
              ? { ...intersection, ...updates }
              : intersection
          ),
        })),
    }),
    { name: "traffic-store" }
  )
)