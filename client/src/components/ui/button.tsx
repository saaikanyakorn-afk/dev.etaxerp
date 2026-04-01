import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--theme-primary)] text-white shadow-sm hover:brightness-90 hover:shadow-md active:scale-[0.98]",
        secondary:
          "bg-[#03c9d7] text-white shadow-sm hover:bg-[#02a8b3] hover:shadow-md active:scale-[0.98]",
        destructive:
          "bg-[#f94d4d] text-white shadow-sm hover:bg-[#e83a3a] hover:shadow-md active:scale-[0.98]",
        warning:
          "bg-[#fec90f] text-white shadow-sm hover:bg-[#e5b50d] hover:shadow-md active:scale-[0.98]",
        success:
          "bg-[#05b187] text-white shadow-sm hover:bg-[#049a75] hover:shadow-md active:scale-[0.98]",
        info:
          "bg-[#539BFF] text-white shadow-sm hover:bg-[#3d8bff] hover:shadow-md active:scale-[0.98]",

        "tonal-primary":
          "bg-[var(--theme-primary-light)] text-[var(--theme-primary)] hover:brightness-95 active:scale-[0.98]",
        "tonal-secondary":
          "bg-[#e5f9fa] text-[#03c9d7] hover:bg-[#ccf3f5] active:scale-[0.98]",
        "tonal-error":
          "bg-[#ffeaea] text-[#f94d4d] hover:bg-[#ffd5d5] active:scale-[0.98]",
        "tonal-warning":
          "bg-[#fffcf0] text-[#fec90f] hover:bg-[#fff5d6] active:scale-[0.98]",
        "tonal-success":
          "bg-[#e6f7f2] text-[#05b187] hover:bg-[#ccefe5] active:scale-[0.98]",
        "tonal-info":
          "bg-[#eef4ff] text-[var(--theme-primary)] hover:bg-[#dde9ff] active:scale-[0.98]",

        outline:
          "border border-[var(--theme-primary)]/60 bg-white text-[var(--theme-primary)] shadow-xs hover:bg-[var(--theme-primary-light)] active:shadow-none active:scale-[0.98]",
        "outline-primary":
          "border border-[var(--theme-primary)] text-[var(--theme-primary)] bg-transparent hover:bg-[var(--theme-primary-light)] active:scale-[0.98]",
        "outline-secondary":
          "border border-[#03c9d7] text-[#03c9d7] bg-transparent hover:bg-[#e5f9fa] active:scale-[0.98]",
        "outline-error":
          "border border-[#f94d4d] text-[#f94d4d] bg-transparent hover:bg-[#ffeaea] active:scale-[0.98]",
        "outline-warning":
          "border border-[#fec90f] text-[#fec90f] bg-transparent hover:bg-[#fffcf0] active:scale-[0.98]",
        "outline-success":
          "border border-[#05b187] text-[#05b187] bg-transparent hover:bg-[#e6f7f2] active:scale-[0.98]",

        ghost:
          "border border-transparent hover:bg-gray-100 active:scale-[0.98]",
        link:
          "text-[var(--theme-primary)] underline-offset-4 hover:underline",
        plain:
          "text-muted-foreground hover:text-foreground",
      },
      size: {
        xs: "min-h-7 px-2.5 py-1 text-xs rounded-md [&_svg]:size-3",
        sm: "min-h-8 px-3 py-1.5 text-xs rounded-md [&_svg]:size-3.5",
        default: "min-h-9 px-4 py-2 text-sm [&_svg]:size-4",
        lg: "min-h-10 px-6 py-2.5 text-sm [&_svg]:size-4",
        xl: "min-h-12 px-8 py-3 text-base rounded-xl [&_svg]:size-5",
        icon: "h-9 w-9 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
