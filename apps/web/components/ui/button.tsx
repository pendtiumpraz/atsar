import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] hover:opacity-90',
        secondary:
          'bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]',
        outline:
          'border border-[rgb(var(--border))] bg-transparent text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))]',
        ghost:
          'text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))]',
        destructive:
          'bg-[rgb(var(--danger))] text-white hover:opacity-90',
        link:
          'underline-offset-4 hover:underline text-[rgb(var(--accent))]',
      },
      size: {
        xs: 'h-7 px-2 text-xs',
        sm: 'h-8 px-3',
        md: 'h-10 px-4',
        lg: 'h-11 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
