import React, { useState } from 'react';
import axios from 'axios';
import {
  Pill,
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  Award,
  CalendarCheck,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { DomainHeader } from '../../components/shared/DomainHeader';
import { SeedDataLoader } from '../../components/shared/SeedDataLoader';

/**
 * Medication Adherence & Habit Streak Tracker Domain Module.
 * Route: /features/adherence
 * 
 * Rules Adherence:
 * - Lazy service execution: Zero auto-fetch on mount. Schedule is fetched only when requested.
 * - On-demand seed loader for baseline patient regimens.
 * - Clean empty states with interactive dose logging.
 */
export function AdherenceDomain({ user, language = 'en' }) {
  const patientId = user?.id || 'demo-patient';

  const [schedule, setSchedule] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // On-demand seed attachment from /seed/mock_patients.json
  const handleSeedLoaded = (seedPatients) => {
    if (!Array.isArray(seedPatients) || seedPatients.length === 0) return;
    const p = seedPatients[0];
    const initialSchedule = (p.activeMedications || [
      { name: 'Metformin 500mg', time: '08:00 AM', status: 'pending' },
      { name: 'Atorvastatin 20mg', time: '09:00 PM', status: 'pending' },
    ]).map((m, idx) => ({
      id: `dose-${idx}`,
      name: typeof m === 'string' ? m : m.name,
      time: m.time || '08:00 AM',
      status: m.status || 'pending',
    }));

    setSchedule(initialSchedule);
    setStats({
      currentStreak: 12,
      longestStreak: 28,
      adherenceRate: 94,
      totalDosesLogged: 45,
    });
    setFeedback(null);
  };

  // Lazy execution: Fetch schedule from /server
  const handleFetchSchedule = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [schedRes, statsRes] = await Promise.all([
        axios.get(`/api/adherence/schedule?patientId=${patientId}`),
        axios.get(`/api/adherence/stats?patientId=${patientId}`),
      ]);
      if (schedRes.data?.schedule) setSchedule(schedRes.data.schedule);
      if (statsRes.data?.stats) setStats(statsRes.data.stats);
    } catch (err) {
      console.warn('Adherence fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  // Log dose status
  const handleLogDose = async (medicineId, medicineName, status) => {
    setSchedule((prev) =>
      prev.map((item) => (item.id === medicineId ? { ...item, status } : item))
    );

    try {
      await axios.post('/api/adherence/log', {
        patientId,
        medicineName,
        status,
        timestamp: new Date().toISOString(),
      });
      setFeedback(`✓ Recorded dose as ${status.toUpperCase()} for ${medicineName}.`);
    } catch (err) {
      console.warn('Logging dose failed', err);
    }
  };

  return (
    <div className="space-y-6">
      <DomainHeader
        title={language === 'en' ? 'Medication Adherence & Habit Streaks' : 'दवा सेवन नियम एवं स्ट्रीक ट्रैकर'}
        description={
          language === 'en'
            ? 'Track daily medication adherence, maintain clinical consistency streaks, and record timestamped dose confirmations.'
            : 'दवाओं का समय पर सेवन रिकॉर्ड करें और निरंतरता स्ट्रीक बनाए रखें।'
        }
        tag="Adherence Engine"
        actions={
          <div className="flex items-center gap-2">
            <SeedDataLoader
              domainId="adherence"
              seedType="patients"
              label="Load Seed Regimen (from /seed)"
              onLoadSeed={handleSeedLoaded}
            />
            <Button
              size="xs"
              variant="outline"
              onClick={handleFetchSchedule}
              isLoading={loading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Sync Records
            </Button>
          </div>
        }
      />

      {/* Habit Streak Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-xs font-semibold">Active Streak</span>
              <Flame className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-2xl font-black text-zinc-950">{stats.currentStreak}</span>
              <span className="text-xs text-zinc-500">days</span>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-xs font-semibold">Adherence Rate</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-2xl font-black text-zinc-950">{stats.adherenceRate}%</span>
              <span className="text-xs text-zinc-500">target 90%+</span>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-xs font-semibold">Longest Streak</span>
              <Award className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-2xl font-black text-zinc-950">{stats.longestStreak}</span>
              <span className="text-xs text-zinc-500">days</span>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="text-xs font-semibold">Doses Recorded</span>
              <CalendarCheck className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-2xl font-black text-zinc-950">{stats.totalDosesLogged}</span>
              <span className="text-xs text-zinc-500">total</span>
            </div>
          </Card>
        </div>
      )}

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-800 font-medium">
          {feedback}
        </div>
      )}

      {/* Schedule Table / List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Daily Medication Schedule</CardTitle>
              <CardDescription>
                Confirm taking your prescribed doses on time to maintain adherence rewards.
              </CardDescription>
            </div>
            <Badge variant="neutral">TODAY'S REGIMEN</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {schedule.length === 0 ? (
            <EmptyState
              icon={<Pill className="w-6 h-6 text-zinc-400" />}
              title="No Doses Scheduled"
              description="Click 'Sync Records' to pull your live schedule or 'Load Seed Regimen' to test daily dose logging."
              actionLabel="Sync Live Schedule"
              onAction={handleFetchSchedule}
              className="py-8"
            />
          ) : (
            <div className="divide-y divide-zinc-100">
              {schedule.map((dose) => (
                <div
                  key={dose.id}
                  className="py-3 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-900 block">{dose.name}</span>
                      <span className="text-[11px] text-zinc-500">Scheduled: {dose.time}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {dose.status === 'taken' ? (
                      <Badge variant="accent">✓ TAKEN</Badge>
                    ) : dose.status === 'skipped' ? (
                      <Badge variant="danger">SKIPPED</Badge>
                    ) : (
                      <>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleLogDose(dose.id, dose.name, 'skipped')}
                        >
                          Skip
                        </Button>
                        <Button
                          size="xs"
                          variant="accent"
                          onClick={() => handleLogDose(dose.id, dose.name, 'taken')}
                          leftIcon={<CheckCircle2 className="w-3 h-3" />}
                        >
                          Mark Taken
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AdherenceDomain;
