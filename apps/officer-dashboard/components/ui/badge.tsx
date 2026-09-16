import * as React from "react"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariantClasses = {
  default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
  destructive: "bg-destructive text-white focus-visible:ring-destructive/20 [a&]:hover:bg-destructive/90",
  outline: "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
  ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
  link: "text-primary underline-offset-4 [a&]:hover:underline",
} as const

type BadgeVariant = keyof typeof badgeVariantClasses

function badgeVariants({ variant = "default", className }: { variant?: BadgeVariant; className?: string } = {}) {
  return cn(
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3",
    badgeVariantClasses[variant],
    className,
  )
}

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  { variant?: BadgeVariant; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
