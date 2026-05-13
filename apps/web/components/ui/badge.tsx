import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ring))] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90',
        secondary:
          'border-transparent bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]',
        accent:
          'border-transparent bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] hover:opacity-90',
        destructive:
          'border-transparent bg-[rgb(var(--danger))] text-white hover:opacity-90',
        success:
          'border-transparent bg-[rgb(var(--success))] text-white hover:opacity-90',
        warning:
          'border-transparent bg-[rgb(var(--warning))] text-white hover:opacity-90',
        outline:
          'border-[rgb(var(--border))] text-[rgb(var(--text))]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
