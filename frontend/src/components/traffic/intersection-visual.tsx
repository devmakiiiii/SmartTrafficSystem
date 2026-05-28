"use client"

import { cn } from "@/lib/utils"
import type { Intersection } from "@/lib/stores/traffic-store"

interface IntersectionVisualProps {
  intersection: Intersection
  size?: number
}

export function IntersectionVisual({ intersection, size = 280 }: IntersectionVisualProps) {
  const getPhase = (): "north" | "south" | "east" | "west" | "red" => {
    if (intersection.emergencyActive) return "north"
    const density = intersection.density * 100
    if (density > 70) return "north"
    if (density > 50) return "south"
    if (density > 30) return "east"
    if (density > 15) return "west"
    return "red"
  }

  const phase = getPhase()
  const isGreen = (dir: string) => phase === dir
  const queueLength = Math.min(10, Math.round(intersection.density * 10))

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative rounded-lg border bg-muted/20 p-4" style={{ width: size, height: size }}>
        <svg viewBox="0 0 280 280" className="absolute inset-0 w-full h-full" fill="none">
          {/* Grass/background */}
          <rect width="280" height="280" fill="#e5e7eb" />

          {/* Roads - vertical (north/south) */}
          <rect x="110" y="0" width="60" height="280" fill="#9ca3af" />

          {/* Roads - horizontal (east/west) */}
          <rect x="0" y="110" width="280" height="60" fill="#9ca3af" />

          {/* Center square (concrete) */}
          <rect x="110" y="110" width="60" height="60" fill="#d1d5dc" />

          {/* Traffic lights - vertical (north/south) */}
          <g transform="translate(125, 90)">
            <rect x="-15" y="-25" width="30" height="50" rx="4" fill="#ffffff" stroke="#d1d5dc" strokeWidth="1" />
            {/* North light */}
            <circle cx="0" cy="-12" r="8" className={cn(isGreen("north") || intersection.emergencyActive ? "fill-green-500" : "fill-red-500")} />
            {/* South light */}
            <circle cx="0" cy="12" r="8" className={cn(isGreen("south") ? "fill-green-500" : "fill-red-500")} />
          </g>

          {/* Traffic lights - horizontal (east/west) */}
          <g transform="translate(165, 125)">
            <rect x="5" y="-15" width="50" height="30" rx="4" fill="#ffffff" stroke="#d1d5dc" strokeWidth="1" />
            {/* East light */}
            <circle cx="12" cy="0" r="8" className={cn(isGreen("east") ? "fill-green-500" : "fill-red-500")} />
            {/* West light */}
            <circle cx="-12" cy="0" r="8" className={cn(isGreen("west") ? "fill-green-500" : "fill-red-500")} />
          </g>

          {/* Vehicle queues - north (approaching from top) */}
          <g transform="translate(120, 100)">
            {Array.from({ length: queueLength }).map((_, i) => (
              <rect
                key={`n-${i}`}
                x={10}
                y={-i * 8 - 6}
                width={8}
                height={6}
                fill={intersection.emergencyActive ? "#ef4444" : "#3b82f6"}
                rx={1}
              />
            ))}
          </g>

          {/* Vehicle queues - south (approaching from bottom) */}
          <g transform="translate(120, 170)">
            {Array.from({ length: queueLength }).map((_, i) => (
              <rect
                key={`s-${i}`}
                x={10}
                y={i * 8}
                width={8}
                height={6}
                fill={intersection.emergencyActive ? "#ef4444" : "#3b82f6"}
                rx={1}
              />
            ))}
          </g>

          {/* Vehicle queues - east (approaching from right) */}
          <g transform="translate(170, 120)">
            {Array.from({ length: queueLength }).map((_, i) => (
              <rect
                key={`e-${i}`}
                x={-i * 8 - 6}
                y={10}
                width={6}
                height={8}
                fill={intersection.emergencyActive ? "#ef4444" : "#3b82f6"}
                rx={1}
              />
            ))}
          </g>

          {/* Vehicle queues - west (approaching from left) */}
          <g transform="translate(100, 120)">
            {Array.from({ length: queueLength }).map((_, i) => (
              <rect
                key={`w-${i}`}
                x={i * 8}
                y={10}
                width={6}
                height={8}
                fill={intersection.emergencyActive ? "#ef4444" : "#3b82f6"}
                rx={1}
              />
            ))}
          </g>

          {/* Emergency vehicle indicator */}
          {intersection.emergencyActive && (
            <g transform="translate(140, 140)">
              <path
                d="M12 2L2 22h20L12 2z"
                fill="#ef4444"
                className="animate-pulse"
              />
              <text x="12" y="16" fontSize="8" textAnchor="middle" fill="white" fontWeight="bold">
                EMS
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Stats overlay */}
      <div className="text-center">
        <p className="text-sm font-medium">{intersection.name}</p>
        <p className="text-xs text-muted-foreground">
          {intersection.vehicleCount} vehicles • {Math.round(intersection.density * 100)}% density
        </p>
      </div>
    </div>
  )
}