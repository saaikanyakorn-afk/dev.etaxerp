import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  color?: "primary" | "secondary" | "success" | "warning" | "error" | "info"
}

const colorMap = {
  primary: { checked: "data-[state=checked]:bg-[#fb9678] data-[state=checked]:border-[#fb9678] data-[state=indeterminate]:bg-[#fb9678] data-[state=indeterminate]:border-[#fb9678]", ring: "focus-visible:ring-[#fb9678]/30" },
  secondary: { checked: "data-[state=checked]:bg-[#03c9d7] data-[state=checked]:border-[#03c9d7] data-[state=indeterminate]:bg-[#03c9d7] data-[state=indeterminate]:border-[#03c9d7]", ring: "focus-visible:ring-[#03c9d7]/30" },
  success: { checked: "data-[state=checked]:bg-[#05b187] data-[state=checked]:border-[#05b187] data-[state=indeterminate]:bg-[#05b187] data-[state=indeterminate]:border-[#05b187]", ring: "focus-visible:ring-[#05b187]/30" },
  warning: { checked: "data-[state=checked]:bg-[#fec90f] data-[state=checked]:border-[#fec90f] data-[state=indeterminate]:bg-[#fec90f] data-[state=indeterminate]:border-[#fec90f]", ring: "focus-visible:ring-[#fec90f]/30" },
  error: { checked: "data-[state=checked]:bg-[#f94d4d] data-[state=checked]:border-[#f94d4d] data-[state=indeterminate]:bg-[#f94d4d] data-[state=indeterminate]:border-[#f94d4d]", ring: "focus-visible:ring-[#f94d4d]/30" },
  info: { checked: "data-[state=checked]:bg-[var(--theme-primary)] data-[state=checked]:border-[var(--theme-primary)] data-[state=indeterminate]:bg-[var(--theme-primary)] data-[state=indeterminate]:border-[var(--theme-primary)]", ring: "focus-visible:ring-[var(--theme-primary)]/30" },
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, color = "primary", ...props }, ref) => {
  const colors = colorMap[color]
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-[18px] w-[18px] shrink-0 rounded-[4px] border-2 border-gray-300 transition-all duration-200 shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2",
        colors.ring,
        colors.checked,
        "data-[state=checked]:text-white data-[state=indeterminate]:text-white",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "grid place-content-center",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("grid place-content-center text-current")}
      >
        {props.checked === "indeterminate" ? (
          <Minus className="h-3.5 w-3.5 stroke-[3]" />
        ) : (
          <Check className="h-3.5 w-3.5 stroke-[3]" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
