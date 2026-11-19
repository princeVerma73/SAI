import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ReportsView() {
  const [fileName, setFileName] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState([]);
  const [summary, setSummary] = useState('');
  const [dietaryTips, setDietaryTips] = useState('');
  const [error, setError] = useState('');
  const [modelUsed, setModelUsed] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);
    setError('');
    setTests([]);
    setSummary('');
    setDietaryTips('');
    setModelUsed('');

    try {
      // Try FastAPI Python endpoint first (uses pypdf + Groq — most reliable)
      const formData = new FormData();
      formData.append('file', file);

      let parsed = null;

      try {
        const aiRes = await axios.post('http://localhost:8000/api/reports/analyze-llm', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 20000,
        });
        if (aiRes.data?.success && aiRes.data?.data?.tests?.length > 0) {
          parsed = aiRes.data.data;
          setModelUsed(aiRes.data.model || 'AI');
        } else if (aiRes.data?.success === false) {
          setError(aiRes.data?.error || 'Could not extract biomarkers from this file.');
          setLoading(false);
          return;
        }
      } catch (aiErr) {
        console.warn('[Reports] FastAPI unavailable, trying Express fallback:', aiErr.message);
      }

      // Express fallback
      if (!parsed) {
        const expFormData = new FormData();
        expFormData.append('file', file);
        expFormData.append('reportTitle', file.name);
        const res = await axios.post('/api/reports/analyze', expFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const d = res.data?.analysis || res.data?.data;
        if (d?.biomarkers?.length > 0) {
          parsed = {
            tests: d.biomarkers.map((b) => ({
              test: b.name || b.test,
              value: `${b.value} ${b.unit || ''}`.trim(),
              normal_range: b.normalMin != null ? `${b.normalMin} – ${b.normalMax}` : (b.range || '—'),
              status: b.status === 'LOW' ? 'Low' : b.status === 'HIGH' ? 'High' : b.status === 'CRITICAL' ? 'Critical' : 'Normal',
            })),
            summary: d.aiSummary || '',
            dietary_tips: '',
          };
          setModelUsed('clinical-reference');
        }
      }

      if (parsed && parsed.tests?.length > 0) {
        setTests(parsed.tests);
        setSummary(parsed.summary || '');
        setDietaryTips(parsed.dietary_tips || '');
      } else {
        setError('No biomarker data found in this file. Please upload a blood/CBC/lab report PDF or image.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to analyze the report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'low':    return { label: 'Low',      cls: 'text-amber-600 font-medium' };
      case 'high':   return { label: 'High',     cls: 'text-red-500 font-medium' };
      case 'critical': return { label: 'Critical', cls: 'text-rose-700 font-bold' };
      default:       return { label: 'Normal',   cls: 'text-[#0f766e] font-medium' };
    }
  };

  return (
    <div className="max-w-4xl w-full">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports</h1>
      <p className="text-sm text-slate-500 mt-1 mb-8">
        Upload a blood, CBC or sugar report (PDF or image).
      </p>

      {/* Upload area — shown when no file yet */}
      {!fileName && !loading && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-14 flex flex-col items-center justify-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all group"
        >
          <Upload className="w-10 h-10 text-slate-300 group-hover:text-teal-500 mb-4 transition-colors" />
          <p className="text-sm font-medium text-slate-600 group-hover:text-teal-700">Click to upload your lab report</p>
          <p className="text-xs text-slate-400 mt-1">PDF, PNG, JPG supported · Max 10MB</p>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
      />

      {/* Loading state */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 flex flex-col items-center gap-3 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-[#0f766e]" />
          <p className="text-sm text-slate-600 font-medium">Analyzing your report with AI...</p>
          <p className="text-xs text-slate-400">Extracting biomarkers from {fileName}</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">Could not analyze report</p>
            <p className="text-xs text-red-500 mt-1">{error}</p>
            <button
              onClick={() => { setFileName(null); setError(''); }}
              className="text-xs text-red-600 underline mt-2"
            >Try another file</button>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && tests.length > 0 && (
        <>
          {/* File header */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#0f766e]" />
                <span className="text-sm font-medium text-slate-700">
                  {fileName} · {tests.length} values found
                </span>
                {modelUsed && (
                  <span className="text-[11px] bg-teal-50 text-[#0f766e] border border-teal-100 px-2 py-0.5 rounded-md font-medium">
                    {modelUsed.includes('gemini') ? '🤖 Gemini Vision' : modelUsed.includes('groq') ? '⚡ Groq AI' : '📋 Reference'}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Replace file
              </button>
            </div>

            {/* Biomarkers Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase tracking-wide">
                    <th className="py-3 px-6">Test</th>
                    <th className="py-3 px-6">Value</th>
                    <th className="py-3 px-6">Normal Range</th>
                    <th className="py-3 px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tests.map((item, idx) => {
                    const { label, cls } = getStatusStyle(item.status);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-6 text-slate-800 font-medium text-sm">{item.test}</td>
                        <td className="py-3.5 px-6 text-slate-700 font-mono text-xs">{item.value}</td>
                        <td className="py-3.5 px-6 text-slate-500 text-xs">{item.normal_range || '—'}</td>
                        <td className={`py-3.5 px-6 text-xs ${cls}`}>{label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          {summary && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 mt-5 shadow-sm">
              <div className="font-bold text-slate-900 text-sm mb-2">Summary</div>
              <p className="text-sm text-slate-600 leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Dietary Tips */}
          {dietaryTips && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-5 mt-4 shadow-sm">
              <div className="font-bold text-[#0f766e] text-sm mb-2">💡 Dietary & Lifestyle Tips</div>
              <p className="text-sm text-slate-700 leading-relaxed">{dietaryTips}</p>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-slate-400 mt-10">
        For awareness only. Not a medical diagnosis.
      </p>
    </div>
  );
}
