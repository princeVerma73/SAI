import React, { useState, useEffect, Suspense, lazy } from 'react';
import axios from 'axios';
import { DOMAINS, DEFAULT_DOMAIN_ID } from './config/domains';
import AppHeader from './components/shared/AppHeader';
import AuthModal from './components/auth/AuthModal';
import DisclaimerModal from './components/compliance/DisclaimerModal';
import ProfileCard from './components/patient/ProfileCard';
import { Loader2 } from 'lucide-react';

// Domain-driven page modules (Lazy loaded for optimal performance)
const TriageDomain = lazy(() => import('./features/triage/TriageDomain'));
const MedicinesDomain = lazy(() => import('./features/medicines/MedicinesDomain'));
const ReportsDomain = lazy(() => import('./features/reports/ReportsDomain'));
const TeleconsultDomain = lazy(() => import('./features/teleconsult/TeleconsultDomain'));
const RiskDomain = lazy(() => import('./features/risk/RiskDomain'));
const AdherenceDomain = lazy(() => import('./features/adherence/AdherenceDomain'));
const KnowledgeDomain = lazy(() => import('./features/knowledge/KnowledgeDomain'));

/**
 * Root Application Container.
 * 
 * Architectural Highlights:
 * - Domain-Driven Page Routing: Replaces monolithic scroll with modular domain routing.
 * - Anti-AI Aesthetic: Crisp typography, zinc monochromes, 1px borders, zero gradient noise.
 * - Lazy Service Execution: Zero eager health checks or auto-polling on mount.
 */
export default function App() {
  const [activeDomain, setActiveDomain] = useState(DEFAULT_DOMAIN_ID);
  const [language, setLanguage] = useState('en');
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Check existing session token on mount (silent session restore)
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      axios
        .get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          if (res.data?.success) {
            setUser(res.data.data.user);
          }
        })
        .catch(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        });
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  // Render the active domain component
  const renderDomainView = () => {
    switch (activeDomain) {
      case 'triage':
        return <TriageDomain language={language} />;
      case 'medicines':
        return <MedicinesDomain user={user} language={language} />;
      case 'reports':
        return <ReportsDomain user={user} language={language} />;
      case 'teleconsult':
        return <TeleconsultDomain user={user} language={language} />;
      case 'risk':
        return <RiskDomain language={language} />;
      case 'adherence':
        return <AdherenceDomain user={user} language={language} />;
      case 'knowledge':
        return <KnowledgeDomain language={language} />;
      default:
        return <TriageDomain language={language} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-950 flex flex-col font-sans">
      {/* Human-Crafted Minimalist Header */}
      <AppHeader
        activeDomain={activeDomain}
        setActiveDomain={setActiveDomain}
        language={language}
        setLanguage={setLanguage}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Main Domain View Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Suspense
          fallback={
            <div className="min-h-[400px] flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            </div>
          }
        >
          {renderDomainView()}
        </Suspense>

        {/* Authenticated Patient Profile Section (if signed in) */}
        {user && (
          <div className="mt-12 pt-8 border-t border-zinc-200/80">
            <ProfileCard
              user={user}
              onProfileUpdated={(updated) =>
                setUser((prev) => ({ ...prev, profile: updated }))
              }
            />
          </div>
        )}
      </main>

      {/* Modals & Overlays */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(authUser) => setUser(authUser)}
      />

      <DisclaimerModal language={language} />

      {/* Restrained Anti-AI Footer */}
      <footer className="border-t border-zinc-200/80 bg-white py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-700">ArogyaAI</span>
            <span>•</span>
            <span>Clinical Decision Support System</span>
          </div>
          <span className="font-mono text-[11px] text-zinc-400">
            Strict Zero-Inline-Mock & Lazy-Execution Protocol
          </span>
        </div>
      </footer>
    </div>
  );
}
