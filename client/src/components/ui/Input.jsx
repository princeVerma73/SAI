import React from 'react';
import { cn } from '../../utils/cn';

export const Input = React.forwardRef(function Input(
  {
    className,
    type = 'text',
    error,
    leftIcon,
    rightElement,
    disabled,
    ...props
  },
  ref
) {
  return (
    <div className="relative w-full">
      {leftIcon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
          {leftIcon}
        </div>
      )}
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          'w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors duration-150',
          'focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950',
          'disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400',
          leftIcon && 'pl-9',
          rightElement && 'pr-10',
          error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500',
          className
        )}
        {...props}
      />
      {rightElement && (
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
          {rightElement}
        </div>
      )}
      {error && (
        <p className="mt-1 text-[11px] text-rose-600 font-medium">{error}</p>
      )}
    </div>
  );
});

export default Input;
