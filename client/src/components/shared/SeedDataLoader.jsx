import React, { useState } from 'react';
import { Database, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

/**
 * On-Demand Seed Data Loader.
 * Strictly adheres to Rule 2: Zero inline mock data and zero static seed imports on initial mount.
 * Dynamically fetches seed records only when explicitly invoked by the user.
 * 
 * @param {{
 *   domainId: string;
 *   seedType: 'medicines' | 'patients' | 'doctors' | 'lab_reports' | 'guidelines';
 *   onLoadSeed: (data: any[]) => void;
 *   label?: string;
 *   disabled?: boolean;
 * }} props
 */
export function SeedDataLoader({
  domainId,
  seedType,
  onLoadSeed,
  label = 'Load Clinical Seed Formulary',
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);
  const [loadedCount, setLoadedCount] = useState(null);

  const handleFetchSeed = async () => {
    setLoading(true);
    try {
      // Dynamic import on explicit user trigger
      let data = [];
      const seedFileMap = {
        medicines: 'mock_medicines.json',
        patients: 'mock_patients.json',
        doctors: 'mock_doctors.json',
        lab_reports: 'mock_lab_reports.json',
        guidelines: 'mock_guidelines.json',
      };

      try {
        switch (seedType) {
          case 'medicines': {
            const mod = await import('../../../../seed/mock_medicines.json');
            data = mod.default || mod;
            break;
          }
          case 'patients': {
            const mod = await import('../../../../seed/mock_patients.json');
            data = mod.default || mod;
            break;
          }
          case 'doctors': {
            const mod = await import('../../../../seed/mock_doctors.json');
            data = mod.default || mod;
            break;
          }
          case 'lab_reports': {
            const mod = await import('../../../../seed/mock_lab_reports.json');
            data = mod.default || mod;
            break;
          }
          case 'guidelines': {
            const mod = await import('../../../../seed/mock_guidelines.json');
            data = mod.default || mod;
            break;
          }
          default:
            console.warn(`Unknown seed type: ${seedType}`);
        }
      } catch (importErr) {
        // Fallback to fetch if filesystem boundary prevents ESM import
        const filename = seedFileMap[seedType];
        if (filename) {
          const res = await fetch(`/seed/${filename}`);
          data = await res.json();
        }
      }

      if (Array.isArray(data)) {
        setLoadedCount(data.length);
        onLoadSeed(data);
      }
    } catch (err) {
      console.error(`Failed to load seed dataset for ${seedType}`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        size="xs"
        variant="outline"
        onClick={handleFetchSeed}
        isLoading={loading}
        disabled={disabled}
        leftIcon={<Database className="w-3.5 h-3.5 text-zinc-500" />}
      >
        {label}
      </Button>
      {loadedCount !== null && (
        <Badge variant="accent" className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>{loadedCount} records attached from /seed</span>
        </Badge>
      )}
    </div>
  );
}

export default SeedDataLoader;
