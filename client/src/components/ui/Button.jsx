import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * @typedef {'primary' | 'secondary' | 'outline' | 'ghost' | 'accent' | 'danger'} ButtonVariant
 * @typedef {'xs' | 'sm' | 'md' | 'lg'} ButtonSize
 */

/**
 * Modern ultra-minimalist button primitive.
 * @param {React.ButtonHTMLAttributes<HTMLButtonElement> & {
 *   variant?: ButtonVariant;
 *   size?: ButtonSize;
 *   isLoading?: boolean;
 *   leftIcon?: React.ReactNode;
 *   rightIcon?: React.ReactNode;
 * }} props
 */
export const Button = React.forwardRef(function Button(
  {
    children,
    className,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    type = 'button',
    ...props
  },
  ref
) {
  const variantStyles = {
    primary:
      'bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950 disabled:bg-zinc-200 disabled:text-zinc-400',
    secondary:
      'bg-zinc-100 text-zinc-900 hover:bg-zinc-200/80 active:bg-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-300',
    outline:
      'border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300 active:bg-zinc-100 shadow-xs disabled:border-zinc-100 disabled:text-zinc-300',
    ghost:
      'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70 active:bg-zinc-200 disabled:text-zinc-300',
    accent:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-xs disabled:bg-emerald-200',
    danger:
      'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-xs disabled:bg-red-200',
  };

  const sizeStyles = {
    xs: 'h-7 px-2.5 text-xs rounded-md gap-1.5',
    sm: 'h-8 px-3 text-xs font-medium rounded-lg gap-1.5',
    md: 'h-9 px-3.5 text-xs sm:text-sm font-medium rounded-lg gap-2',
    lg: 'h-10 px-4 text-sm font-medium rounded-lg gap-2',
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center select-none font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 disabled:cursor-not-allowed',
        variantStyles[variant] || variantStyles.primary,
        sizeStyles[size] || sizeStyles.md,
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
});

export default Button;
