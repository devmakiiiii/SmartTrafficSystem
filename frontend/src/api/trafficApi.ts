import { API_BASE } from "./config"

export async function getTrafficStatus() {
  const res = await fetch(`${API_BASE}/api/traffic/status`)
  return res.json()
}

export async function predictCongestion(data: {
  hour: number
  day_of_week: number
  vehicle_count: number
  weather?: number
  is_holiday?: number
  temperature?: number
}) {
  const res = await fetch(`${API_BASE}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function optimizeSignal(data: {
  intersection_id: string
  density: number
  weather?: string
  emergency?: boolean
  is_peak?: boolean
}) {
  const res = await fetch(`${API_BASE}/api/signal/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function activateEmergency(data: {
  vehicle_type?: string
  from_intersection: string
  to_intersection: string
}) {
  const res = await fetch(`${API_BASE}/api/emergency/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function getRoute(start: string, goal: string, algorithm = "astar") {
  const res = await fetch(`${API_BASE}/api/route/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, goal, algorithm }),
  })
  return res.json()
}

export async function getBayesianEstimate(evidence: Record<string, boolean>) {
  const res = await fetch(`${API_BASE}/api/bayesian/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(evidence),
  })
  return res.json()
} 