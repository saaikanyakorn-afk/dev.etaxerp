import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X, AlertCircle, AlertTriangle, Info, CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-md px-4 py-3 text-sm flex items-start gap-3",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border",
        destructive: "",
        warning: "",
        info: "",
        success: "",
      },
      appearance: {
        basic: "",
        filled: "",
        outlined: "",
      },
    },
    compoundVariants: [
      { variant: "destructive", appearance: "basic", className: "bg-[#fdede8] text-[#f94d4d] border-0" },
      { variant: "destructive", appearance: "filled", className: "bg-[#f94d4d] text-white border-0" },
      { variant: "destructive", appearance: "outlined", className: "bg-[#fdede8]/50 text-[#f94d4d] border border-[#f94d4d]/30" },
      { variant: "warning", appearance: "basic", className: "bg-[#fff8e1] text-[#e6a700] border-0" },
      { variant: "warning", appearance: "filled", className: "bg-[#fec90f] text-white border-0" },
      { variant: "warning", appearance: "outlined", className: "bg-[#fff8e1]/50 text-[#e6a700] border border-[#fec90f]/30" },
      { variant: "info", appearance: "basic", className: "bg-[#e8f4fd] text-[var(--theme-primary)] border-0" },
      { variant: "info", appearance: "filled", className: "bg-[var(--theme-primary)] text-white border-0" },
      { variant: "info", appearance: "outlined", className: "bg-[#e8f4fd]/50 text-[var(--theme-primary)] border border-[var(--theme-primary)]/30" },
      { variant: "success", appearance: "basic", className: "bg-[#e6f4ef] text-[#05b187] border-0" },
      { variant: "success", appearance: "filled", className: "bg-[#05b187] text-white border-0" },
      { variant: "success", appearance: "outlined", className: "bg-[#e6f4ef]/50 text-[#05b187] border border-[#05b187]/30" },
    ],
    defaultVariants: {
      variant: "default",
      appearance: "basic",
    },
  }
)

const alertIconMap = {
  destructive: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
  default: Info,
}

const alertIconColors = {
  destructive: { basic: "text-[#f94d4d]", filled: "text-white", outlined: "text-[#f94d4d]" },
  warning: { basic: "text-[#e6a700]", filled: "text-white", outlined: "text-[#e6a700]" },
  info: { basic: "text-[var(--theme-primary)]", filled: "text-white", outlined: "text-[var(--theme-primary)]" },
  success: { basic: "text-[#05b187]", filled: "text-white", outlined: "text-[#05b187]" },
  default: { basic: "text-foreground", filled: "text-white", outlined: "text-foreground" },
}

interface FlexyAlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  showIcon?: boolean
  closable?: boolean
  onClose?: () => void
}

const Alert = React.forwardRef<HTMLDivElement, FlexyAlertProps>(
  ({ className, variant = "default", appearance = "basic", showIcon = false, closable = false, onClose, children, ...props }, ref) => {
    const IconComponent = alertIconMap[variant || "default"]
    const iconColor = alertIconColors[variant || "default"][appearance || "basic"]

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant, appearance }), className)}
        {...props}
      >
        {showIcon && IconComponent && (
          <span className="flex-shrink-0 mt-0.5">
            <IconComponent className={cn("w-5 h-5", iconColor)} />
          </span>
        )}
        <div className="flex-1 min-w-0">{children}</div>
        {closable && (
          <button
            onClick={onClose}
            className={cn(
              "flex-shrink-0 rounded-md p-0.5 transition-opacity hover:opacity-70",
              appearance === "filled" ? "text-white/80 hover:text-white" : ""
            )}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("font-semibold leading-tight tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm opacity-90 [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
