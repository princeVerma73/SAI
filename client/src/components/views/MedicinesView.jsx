import React, { useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

export default function MedicinesView() {
  const [medicineInput, setMedicineInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [duplicates, setDuplicates] = useState({ count: 0, text: '' });
  const [interactions, setInteractions] = useState({ count: 0, text: '' });
  const [sideEffects, setSideEffects] = useState({ text: '', sources: '' });

  const handleCheck = async (e) => {
    e?.preventDefault();
    const raw = medicineInput.trim();
    if (!raw || loading) return;

    const list = raw.split(',').map((m) => m.trim()).filter(Boolean);
    if (list.length === 0) return;

    setLoading(true);
    setChecked(false);

    try {
      const res = await axios.post('/api/medicines/analyze', { medicines: list });
      if (res.data?.success) {
        const payload = res.data;
        const dups = payload.duplicateWarnings || payload.data?.duplicateWarnings || [];
        const inters = payload.detectedInteractions || payload.data?.detectedInteractions || [];
        const meds = payload.individualMedicines || payload.data?.individualMedicines || [];

        // Duplicates
        if (dups.length > 0) {
          const d = dups[0];
          const involved = (d.involvedMedicines || []).join(' and ');
          setDuplicates({
            count: dups.length,
            text: `${involved} both contain ${d.ingredient?.toLowerCase() || 'the same active ingredient'}. Taking both can cause an overdose.`,
          });
        } else {
          setDuplicates({ count: 0, text: 'No duplicate active ingredients detected.' });
        }

        // Interactions
        if (inters.length > 0) {
          const inter = inters[0];
          setInteractions({
            count: inters.length,
            text: `${inter.pair || 'Drug interaction'}: ${inter.clinicalConsequence || inter.warning || 'Adverse interaction detected'}.`,
          });
        } else {
          setInteractions({ count: 0, text: 'No known interactions detected between these medicines.' });
        }

        // Side Effects
        if (meds.length > 0) {
          const sideList = meds
            .filter((m) => m.sideEffects?.length > 0)
            .map((m) => `${m.generic || m.brand}: ${m.sideEffects.slice(0, 2).join(', ').toLowerCase()}`)
            .join('. ');
          setSideEffects({
            text: sideList || `${list.join(', ')}: consult prescribing physician for complete side-effect profile.`,
            sources: 'drug label data · DDInter interaction table',
          });
        } else {
          setSideEffects({
            text: `${list.join(', ')}: consult your pharmacist or prescribing doctor for side-effect details.`,
            sources: 'drug label data',
          });
        }
      }
    } catch {
      setDuplicates({ count: 0, text: 'Could not connect to medicine database. Please try again.' });
      setInteractions({ count: 0, text: '' });
      setSideEffects({ text: '', sources: '' });
    } finally {
      setChecked(true);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl w-full">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Medicines</h1>
      <p className="text-sm text-slate-500 mt-1 mb-8">
        Enter the medicines you take to check interactions, duplicates and side effects.
      </p>

      {/* Input Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
        <label className="text-xs text-slate-500 font-medium mb-2 block">Medicine names (comma separated)</label>
        <form onSubmit={handleCheck} className="flex items-center gap-3">
          <input
            type="text" value={medicineInput} onChange={(e) => setMedicineInput(e.target.value)}
            placeholder="e.g. Crocin, Dolo 650, Aspirin"
            className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition-colors"
          />
          <button type="submit" disabled={loading || !medicineInput.trim()}
            className="bg-[#0f766e] hover:bg-[#115e59] disabled:opacity-50 text-white font-medium text-sm px-6 py-2.5 rounded-lg transition-colors flex items-center justify-center shadow-sm">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /><span>Checking...</span></> : 'Check'}
          </button>
        </form>
      </div>

      {/* Empty state */}
      {!checked && !loading && (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm text-slate-400">Enter medicine names above and click Check</p>
          <p className="text-xs text-slate-300 mt-1">Results for duplicates, interactions and side effects will appear here</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#0f766e]" />
          <span className="text-sm text-slate-500">Checking medicine database...</span>
        </div>
      )}

      {/* Results */}
      {checked && !loading && (
        <div className="space-y-4">
          {/* Duplicates */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-slate-900 text-sm">Duplicates</span>
              {duplicates.count > 0 ? (
                <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-medium">{duplicates.count} found</span>
              ) : (
                <span className="bg-teal-50 text-[#0f766e] text-xs px-2.5 py-0.5 rounded-full font-medium">None found</span>
              )}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{duplicates.text}</p>
          </div>

          {/* Interactions */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-slate-900 text-sm">Interactions</span>
              {interactions.count > 0 ? (
                <span className="bg-red-100 text-red-800 text-xs px-2.5 py-0.5 rounded-full font-medium">{interactions.count} found</span>
              ) : (
                <span className="bg-teal-50 text-[#0f766e] text-xs px-2.5 py-0.5 rounded-full font-medium">None found</span>
              )}
            </div>
            {interactions.text && <p className="text-sm text-slate-700 leading-relaxed">{interactions.text}</p>}
          </div>

          {/* Side Effects */}
          {sideEffects.text && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="font-bold text-slate-900 text-sm mb-2">Common side effects</div>
              <p className="text-sm text-slate-700 leading-relaxed">{sideEffects.text}</p>
              {sideEffects.sources && (
                <div className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-100">
                  Sources: {sideEffects.sources}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-10">For awareness only. Not a medical diagnosis.</p>
    </div>
  );
}
