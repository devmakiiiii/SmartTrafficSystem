"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/intersections", label: "Intersections" },
  { href: "/analytics", label: "Analytics" },
  { href: "/predictions", label: "Predictions" },
  { href: "/settings", label: "Settings" },
]

export function AppHeader() {
  const pathname = usePathname()

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm">
      <div className="flex h-16 items-center px-4">
        <h1 className="text-lg font-semibold">Smart Traffic System</h1>
        <nav className="ml-auto flex items-center space-x-2">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant={pathname === item.href ? "secondary" : "ghost"}
              size="sm"
              asChild
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>
      </div>
    </header>
  )
}