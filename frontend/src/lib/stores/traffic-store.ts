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
          name: "EDSA & Roxas Boulevard",
          location: { lat: 14.5587, lng: 121.0234 },
          status: "operational",
          vehicleCount: 127,
          density: 0.35,
          emergencyActive: false,
        },
        {
          id: "I2",
          name: "EDSA & Ayala Avenue",
          location: { lat: 14.5551, lng: 121.0244 },
          status: "warning",
          vehicleCount: 200,
          density: 0.55,
          emergencyActive: false,
        },
        {
          id: "I3",
          name: "EDSA & Boni Avenue",
          location: { lat: 14.5765, lng: 121.0356 },
          status: "operational",
          vehicleCount: 80,
          density: 0.25,
          emergencyActive: false,
        },
        {
          id: "I4",
          name: "EDSA & Magsaysay Boulevard",
          location: { lat: 14.6178, lng: 121.0359 },
          status: "operational",
          vehicleCount: 150,
          density: 0.40,
          emergencyActive: false,
        },
        {
          id: "I5",
          name: "EDSA & Quezon Avenue",
          location: { lat: 14.6300, lng: 121.0300 },
          status: "warning",
          vehicleCount: 180,
          density: 0.60,
          emergencyActive: false,
        },
        {
          id: "I6",
          name: "EDSA & Ortigas Avenue",
          location: { lat: 14.5833, lng: 121.0589 },
          status: "operational",
          vehicleCount: 95,
          density: 0.30,
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