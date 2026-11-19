import React, { useState } from 'react';
import AskView from './components/views/AskView';
import ReportsView from './components/views/ReportsView';
import MedicinesView from './components/views/MedicinesView';
import RiskAndPlanView from './components/views/RiskAndPlanView';
import VoiceView from './components/views/VoiceView';

const NAV_ITEMS = [
  { id: 'ask', label: 'Ask' },
  { id: 'reports', label: 'Reports' },
  { id: 'medicines', label: 'Medicines' },
  { id: 'risk', label: 'Risk and plan' },
  { id: 'voice', label: 'Voice' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('reports');

  const renderContent = () => {
    switch (activeTab) {
      case 'ask':
        return <AskView />;
      case 'reports':
        return <ReportsView />;
      case 'medicines':
        return <MedicinesView />;
      case 'risk':
        return <RiskAndPlanView />;
      case 'voice':
        return <VoiceView />;
      default:
        return <ReportsView />;
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex font-sans antialiased">
      {/* Left Navigation Sidebar */}
      <aside className="w-64 border-r border-slate-200/80 bg-white min-h-screen p-8 flex flex-col flex-shrink-0">
        {/* Brand / Logo */}
        <div className="mb-10">
          <span className="font-bold text-xl text-slate-900 tracking-tight">
            HealthAssist
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5 flex-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[#e2f2ef] text-[#0f766e] font-medium'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-normal'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-h-screen bg-white p-8 sm:p-12 overflow-y-auto">
        <div className="max-w-4xl">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
