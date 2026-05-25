import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { Intersection, TrafficMetrics, TrafficData } from "../types"

interface TrafficState {
  intersections: Intersection[]
  selectedIntersection: Intersection | null
  trafficMetrics: TrafficMetrics
  trafficHistory: TrafficData[]
  isDarkMode: boolean
  setSelectedIntersection: (intersection: Intersection | null) => void
  updateTrafficMetrics: (metrics: Partial<TrafficMetrics>) => void
  addTrafficData: (data: TrafficData) => void
  toggleDarkMode: () => void
}

export const useTrafficStore = create<TrafficState>()(
  devtools(
    (set) => ({
      intersections: [
        {
          id: "int-001",
          name: "Main St & Oak Ave",
          location: { lat: 40.7128, lng: -74.006 },
          status: "operational",
          vehicleCount: 127,
          density: 0.65,
          signalTiming: { north: 30, south: 30, east: 45, west: 45 },
        },
        {
          id: "int-002",
          name: "Broadway & 5th Street",
          location: { lat: 40.7135, lng: -74.008 },
          status: "warning",
          vehicleCount: 89,
          density: 0.42,
          signalTiming: { north: 25, south: 25, east: 35, west: 35 },
        },
        {
          id: "int-003",
          name: "Park Ave & 42nd St",
          location: { lat: 40.7142, lng: -74.01 },
          status: "operational",
          vehicleCount: 203,
          density: 0.81,
          signalTiming: { north: 40, south: 40, east: 50, west: 50 },
        },
        {
          id: "int-004",
          name: "7th Ave & 34th St",
          location: { lat: 40.715, lng: -74.012 },
          status: "error",
          vehicleCount: 156,
          density: 0.78,
          signalTiming: { north: 35, south: 35, east: 45, west: 45 },
        },
      ],
      selectedIntersection: null,
      trafficMetrics: {
        totalVehicles: 575,
        averageSpeed: 24.5,
        congestionLevel: 0.64,
        waitTime: 42,
        emergencyVehicles: 3,
      },
      trafficHistory: [],
      isDarkMode: false,
      setSelectedIntersection: (intersection) => set({ selectedIntersection: intersection }),
      updateTrafficMetrics: (metrics) =>
        set((state) => ({
          trafficMetrics: { ...state.trafficMetrics, ...metrics },
        })),
      addTrafficData: (data) =>
        set((state) => ({
          trafficHistory: [...state.trafficHistory.slice(-49), data],
        })),
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
    }),
    { name: "traffic-store" }
  )
)