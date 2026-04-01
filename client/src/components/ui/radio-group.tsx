import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"

import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

interface RadioGroupItemProps extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  color?: "primary" | "secondary" | "success" | "warning" | "error" | "info"
}

const colorMap = {
  primary: { border: "border-[#fb9678]", bg: "bg-[#fb9678]", ring: "focus-visible:ring-[#fb9678]/30" },
  secondary: { border: "border-[#03c9d7]", bg: "bg-[#03c9d7]", ring: "focus-visible:ring-[#03c9d7]/30" },
  success: { border: "border-[#05b187]", bg: "bg-[#05b187]", ring: "focus-visible:ring-[#05b187]/30" },
  warning: { border: "border-[#fec90f]", bg: "bg-[#fec90f]", ring: "focus-visible:ring-[#fec90f]/30" },
  error: { border: "border-[#f94d4d]", bg: "bg-[#f94d4d]", ring: "focus-visible:ring-[#f94d4d]/30" },
  info: { border: "border-[var(--theme-primary)]", bg: "bg-[var(--theme-primary)]", ring: "focus-visible:ring-[var(--theme-primary)]/30" },
}

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, color = "primary", ...props }, ref) => {
  const colors = colorMap[color]
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-[18px] w-[18px] rounded-full border-2 transition-all duration-200 shadow-sm focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        colors.ring,
        "border-gray-300",
        className
      )}
      data-color={color}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <span className={cn("block h-2 w-2 rounded-full", colors.bg)} />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export { RadioGroup, RadioGroupItem }
