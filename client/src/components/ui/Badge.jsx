import React from 'react';
import { cn } from '../../utils/cn';

/**
 * @typedef {'neutral' | 'accent' | 'warning' | 'danger' | 'outline'} BadgeVariant
 */

/**
 * Modern ultra-minimalist badge primitive.
 * @param {React.HTMLAttributes<HTMLDivElement> & {
 *   variant?: BadgeVariant;
 * }} props
 */
export function Badge({
  className,
  variant = 'neutral',
  children,
  ...props
}) {
  const variantStyles = {
    neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200/80',
    accent: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    outline: 'bg-transparent text-zinc-600 border-zinc-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border tracking-tight',
        variantStyles[variant] || variantStyles.neutral,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
