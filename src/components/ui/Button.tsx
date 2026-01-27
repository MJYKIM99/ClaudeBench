import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-md)] cursor-pointer transition-all duration-[120ms] ease-out border disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-primary)] text-white border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)]',
        secondary:
          'bg-[var(--color-surface)] text-[var(--color-dark)] border-[var(--color-border)] hover:bg-[var(--color-light)] hover:border-[var(--color-mid-gray)]',
        ghost:
          'bg-transparent text-[var(--color-text-secondary)] border-transparent hover:bg-[var(--color-light)] hover:text-[var(--color-dark)]',
        danger:
          'bg-[var(--color-error)] text-white border-[var(--color-error)] hover:bg-red-600 hover:border-red-600',
      },
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-[13px]',
        lg: 'px-6 py-3 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
