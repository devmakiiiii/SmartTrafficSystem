"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Bell, Shield, Globe, Moon, Sun, Monitor } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"

export default function SettingsPage() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <MainLayout title="Settings" description="Configure system preferences">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="alerts" className="text-base">
                  Traffic Alerts
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications about traffic conditions
                </p>
              </div>
              <Switch id="alerts" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emergency" className="text-base">
                  Emergency Vehicle Tracking
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get alerts for approaching emergency vehicles
                </p>
              </div>
              <Switch id="emergency" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="maintenance" className="text-base">
                  Maintenance Reminders
                </Label>
                <p className="text-sm text-muted-foreground">
                  Schedule and track maintenance tasks
                </p>
              </div>
              <Switch id="maintenance" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="data-collection" className="text-base">
                  Data Collection
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow anonymized traffic data collection
                </p>
              </div>
              <Switch id="data-collection" />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="two-factor" className="text-base">
                  Two-Factor Authentication
                </Label>
                <p className="text-sm text-muted-foreground">
                  Add extra security to your account
                </p>
              </div>
              <Switch id="two-factor" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base">Theme</Label>
              <div className="flex gap-2">
                <Button
                  variant={resolvedTheme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("light")}
                  className="flex-1"
                >
                  <Sun className="mr-2 h-4 w-4" />
                  Light
                </Button>
                <Button
                  variant={resolvedTheme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("dark")}
                  className="flex-1"
                >
                  <Moon className="mr-2 h-4 w-4" />
                  Dark
                </Button>
                <Button
                  variant={resolvedTheme === "system" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("system")}
                  className="flex-1"
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  System
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="refresh" className="text-base">
                  Auto Refresh
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically refresh traffic data
                </p>
              </div>
              <Switch id="refresh" defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}