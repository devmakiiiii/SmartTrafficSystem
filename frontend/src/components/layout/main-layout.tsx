"use client"

import { AppHeader } from "./app-header"
import { Toaster } from "@/components/ui/sonner"

interface MainLayoutProps {
  children: React.ReactNode
  title: string
  description?: string
}

export function MainLayout({ children, title, description }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          {(title || description) && (
            <div className="mb-8">
              {title && <h2 className="text-3xl font-bold tracking-tight">{title}</h2>}
              {description && <p className="text-muted-foreground">{description}</p>}
            </div>
          )}
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  )
}