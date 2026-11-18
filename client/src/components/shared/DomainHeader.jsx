import React from 'react';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';

/**
 * Standardized domain header.
 * @param {{
 *   title: string;
 *   description?: string;
 *   tag?: string;
 *   badgeVariant?: 'neutral' | 'accent' | 'warning' | 'danger';
 *   actions?: React.ReactNode;
 *   className?: string;
 * }} props
 */
export function DomainHeader({
  title,
  description,
  tag,
  badgeVariant = 'accent',
  actions,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-200/80 mb-6',
        className
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950">
            {title}
          </h1>
          {tag && <Badge variant={badgeVariant}>{tag}</Badge>}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-zinc-500 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default DomainHeader;
