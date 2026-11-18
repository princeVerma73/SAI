import React, { useState } from 'react';
import axios from 'axios';
import { Activity, PhoneCall, Globe2, User, LogOut, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { DOMAINS } from '../../config/domains';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';

/**
 * Minimalist, human-designed application header.
 * Eliminates gratuitous multi-color gradients in favor of sharp typographic hierarchy and clean hairline borders.
 */
export function AppHeader({
  activeDomain,
  setActiveDomain,
  language = 'en',
  setLanguage,
  user,
  onOpenAuth,
  onSignOut,
}) {
  const [healthStatus, setHealthStatus] = useState('idle'); // 'idle' | 'checking' | 'online' | 'offline'

  // Lazy, user-triggered API health check (Zero auto-ping on mount)
  const handleCheckHealth = async () => {
    setHealthStatus('checking');
    try {
      const res = await axios.get('/api/health');
      if (res.data?.status === 'ok' || res.status === 200) {
        setHealthStatus('online');
      } else {
        setHealthStatus('offline');
      }
    } catch {
      setHealthStatus('offline');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-zinc-200/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-14 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold text-sm tracking-tighter">
              A
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold tracking-tight text-zinc-950">
                ArogyaAI
              </span>
              <span className="hidden sm:inline-block text-[11px] font-mono text-zinc-500">
                v1.0-prod
              </span>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Lazy Backend Health Ping */}
            <div className="hidden md:flex items-center">
              {healthStatus === 'idle' ? (
                <button
                  type="button"
                  onClick={handleCheckHealth}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                  title="Check live /server connectivity on-demand"
                >
                  <Activity className="w-3 h-3 text-zinc-400" />
                  <span>Check API</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCheckHealth}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors',
                    healthStatus === 'checking' && 'bg-zinc-50 border-zinc-200 text-zinc-500',
                    healthStatus === 'online' && 'bg-emerald-50 border-emerald-200 text-emerald-700',
                    healthStatus === 'offline' && 'bg-rose-50 border-rose-200 text-rose-700'
                  )}
                >
                  {healthStatus === 'checking' && (
                    <RefreshCw className="w-3 h-3 animate-spin text-zinc-400" />
                  )}
                  {healthStatus === 'online' && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  )}
                  {healthStatus === 'offline' && (
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                  )}
                  <span>
                    {healthStatus === 'checking'
                      ? 'Probing...'
                      : healthStatus === 'online'
                      ? 'Server Online'
                      : 'Server Offline'}
                  </span>
                </button>
              )}
            </div>

            {/* Language Switcher */}
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors"
              title="Toggle language"
            >
              <Globe2 className="w-3.5 h-3.5 text-zinc-500" />
              <span>{language === 'en' ? 'हिन्दी' : 'EN'}</span>
            </button>

            {/* Authentication Action */}
            {user ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200">
                <span className="text-xs font-semibold text-zinc-900">
                  {user.profile?.firstName || user.email?.split('@')[0]}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  title="Sign out"
                  className="text-zinc-400 hover:text-rose-600 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Button
                size="xs"
                variant="outline"
                onClick={onOpenAuth}
                leftIcon={<User className="w-3 h-3" />}
              >
                Sign In
              </Button>
            )}

            {/* Emergency SOS Shortcut */}
            <a
              href="tel:108"
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <PhoneCall className="w-3 h-3" />
              <span>108 SOS</span>
            </a>
          </div>
        </div>

        {/* Domain-Driven Navigation Bar */}
        <nav
          className="flex items-center gap-1 overflow-x-auto py-2 -mb-px scrollbar-none border-t border-zinc-100"
          aria-label="Domain Tabs"
        >
          {DOMAINS.map((domain) => {
            const Icon = domain.icon;
            const isActive = activeDomain === domain.id;
            return (
              <button
                key={domain.id}
                type="button"
                onClick={() => setActiveDomain(domain.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors duration-150',
                  isActive
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80'
                )}
              >
                <Icon
                  className={cn(
                    'w-3.5 h-3.5',
                    isActive ? 'text-emerald-400' : 'text-zinc-400'
                  )}
                />
                <span>{language === 'en' ? domain.label : domain.labelHi}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export default AppHeader;
