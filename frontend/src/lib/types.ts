export type IntersectionStatus = "operational" | "warning" | "error"

export interface Intersection {
  id: string
  name: string
  location: { lat: number; lng: number }
  status: IntersectionStatus
  vehicleCount: number
  density: number
  signalTiming: { north: number; south: number; east: number; west: number }
}

export interface TrafficData {
  timestamp: Date
  vehicleCount: number
  averageSpeed: number
  congestionLevel: number
}

export interface TrafficMetrics {
  totalVehicles: number
  averageSpeed: number
  congestionLevel: number
  waitTime: number
  emergencyVehicles: number
}