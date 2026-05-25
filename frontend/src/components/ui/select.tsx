"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

function Select({ ...props }: SelectPrimitive.SelectProps) {
  return <SelectPrimitive.Root {...props} />
}

function SelectGroup({ ...props }: SelectPrimitive.SelectGroupProps) {
  return <SelectPrimitive.Group {...props} />
}

function SelectValue({ ...props }: SelectPrimitive.SelectValueProps) {
  return <SelectPrimitive.Value {...props} />
}

function SelectTrigger({ className, children, ...props }: SelectPrimitive.SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm shadow-xs",
        "border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({ className, children, ...props }: SelectPrimitive.SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          "w-[var(--radix-select-trigger-width)] min-w-[8rem] rounded-lg border bg-popover p-1 shadow-md",
          "border-border",
          className
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton>
          <ChevronUp className="h-4 w-4" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton>
          <ChevronDown className="h-4 w-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.SelectItemProps) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded px-2 py-1.5 text-sm",
        "hover:bg-muted focus:bg-muted focus:text-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">✓</span>
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectLabel({ className, ...props }: SelectPrimitive.SelectLabelProps) {
  return <SelectPrimitive.Label className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />
}

function SelectSeparator({ className, ...props }: SelectPrimitive.SelectSeparatorProps) {
  return <SelectPrimitive.Separator className={cn("my-1 h-px bg-border", className)} {...props} />
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
}