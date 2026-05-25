"use client"

import { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface TrafficMetricsCardProps {
  title: string
  value: string | number
  unit?: string
  change?: string
  changeType?: "positive" | "negative" | "neutral"
  icon: LucideIcon
  iconColor?: string
}

export function TrafficMetricsCard({
  title,
  value,
  unit = "",
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "text-blue-600",
}: TrafficMetricsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", iconColor)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value}
          {unit && <span className="text-sm font-normal text-muted-foreground">{unit}</span>}
        </div>
        {change && (
          <p
            className={cn(
              "text-xs text-muted-foreground",
              changeType === "positive" && "text-green-600",
              changeType === "negative" && "text-red-600"
            )}
          >
            {change}
          </p>
        )}
      </CardContent>
    </Card>
  )
}