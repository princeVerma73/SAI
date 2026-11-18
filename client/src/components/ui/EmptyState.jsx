import React from 'react';
import { cn } from '../../utils/cn';
import { Button } from './Button';
import { Database, Plus } from 'lucide-react';

/**
 * Clean, modern empty state primitive.
 * @param {{
 *   icon?: React.ReactNode;
 *   title: string;
 *   description?: string;
 *   actionLabel?: string;
 *   onAction?: () => void;
 *   seedLabel?: string;
 *   onLoadSeed?: () => void;
 *   isSeedLoading?: boolean;
 *   className?: string;
 * }} props
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  seedLabel,
  onLoadSeed,
  isSeedLoading = false,
  className,
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-zinc-200/90 bg-zinc-50/50 p-8 text-center flex flex-col items-center justify-center transition-colors',
        className
      )}
    >
      <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 mb-3">
        {icon || <Database className="w-5 h-5 text-zinc-400" />}
      </div>
      <h4 className="text-sm font-semibold text-zinc-900 tracking-tight">
        {title}
      </h4>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-zinc-500 leading-relaxed">
          {description}
        </p>
      )}

      {(onAction || onLoadSeed) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onAction && actionLabel && (
            <Button
              size="sm"
              variant="primary"
              onClick={onAction}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              {actionLabel}
            </Button>
          )}

          {onLoadSeed && seedLabel && (
            <Button
              size="sm"
              variant="outline"
              onClick={onLoadSeed}
              isLoading={isSeedLoading}
              leftIcon={<Database className="w-3.5 h-3.5 text-zinc-500" />}
            >
              {seedLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
