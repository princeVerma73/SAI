import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Upload, Loader2, AlertTriangle, CheckCircle, Send, MessageSquare, History, Sparkles } from 'lucide-react';

export default function ReportsView() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // In-Memory (Local RAM) Stored Reports History
  const [savedReports, setSavedReports] = useState(() => {
    try {
      const saved = sessionStorage.getItem('healthassist_ram_reports');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeReportIndex, setActiveReportIndex] = useState(0);

  // Active Report Details
  const activeReport = savedReports[activeReportIndex] || null;

  // Chat State for Right-Side Assistant
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // Save to sessionStorage (Local RAM for the session)
  useEffect(() => {
    try {
      sessionStorage.setItem('healthassist_ram_reports', JSON.stringify(savedReports));
    } catch (e) {
      console.warn('Could not cache report history in RAM:', e);
    }
  }, [savedReports]);

  // When active report changes, initialize chat context
  useEffect(() => {
    if (activeReport) {
      const abnormalList = (activeReport.tests || [])
        .filter((t) => t.status?.toLowerCase() === 'high' || t.status?.toLowerCase() === 'low' || t.status?.toLowerCase() === 'critical')
        .map((t) => `${t.test} (${t.value} - ${t.status})`)
        .join(', ');

      setChatMessages([
        {
          id: 1,
          sender: 'system',
          text: `Hello! I have reviewed **${activeReport.fileName}**${activeReport.patientName ? ` for ${activeReport.patientName}` : ''}. ${
            abnormalList ? `I noticed ${abnormalList}.` : 'All biomarkers appear within standard reference intervals.'
          } Feel free to ask me anything about your test results.`,
        },
      ]);
    } else {
      setChatMessages([]);
    }
  }, [activeReportIndex, savedReports.length]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('reportTitle', file.name);

      let parsedData = null;

      // 1. Try Python FastAPI AI Service directly
      try {
        const aiRes = await axios.post('http://localhost:8000/api/reports/analyze-llm', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        });

        if (aiRes.data?.success && aiRes.data?.data?.tests?.length > 0) {
          parsedData = aiRes.data.data;
        }
      } catch (aiErr) {
        console.warn('[Reports] Direct AI Service upload failed, falling back to Express:', aiErr.message);
      }

      // 2. Fallback to Express backend /api/reports/analyze
      if (!parsedData) {
        const expFormData = new FormData();
        expFormData.append('file', file);
        expFormData.append('reportTitle', file.name);

        const expRes = await axios.post('/api/reports/analyze', expFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 25000,
        });

        const d = expRes.data?.analysis || expRes.data?.data;
        if (d && (d.tests?.length > 0 || d.biomarkers?.length > 0)) {
          const rawTests = d.tests || d.biomarkers;
          parsedData = {
            patient_name: d.patientName || '',
            lab_name: d.labName || '',
            tests: rawTests.map((t) => ({
              test: t.test || t.name,
              value: `${t.value} ${t.unit || ''}`.trim(),
              normal_range: t.normal_range || (t.normalMin != null ? `${t.normalMin} - ${t.normalMax}` : (t.range || 'Reference')),
              status: t.status === 'LOW' ? 'Low' : t.status === 'HIGH' ? 'High' : t.status === 'CRITICAL' ? 'Critical' : (t.status || 'Normal'),
            })),
            summary: d.aiSummary || d.summary || '',
            dietary_tips: d.dietary_tips || '',
          };
        }
      }

      if (parsedData && parsedData.tests && parsedData.tests.length > 0) {
        const newReportItem = {
          id: Date.now(),
          fileName: file.name,
          patientName: parsedData.patient_name || '',
          labName: parsedData.lab_name || '',
          uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tests: parsedData.tests,
          summary: parsedData.summary || '',
          dietaryTips: parsedData.dietary_tips || '',
        };

        // Add to RAM list (avoiding duplicate filenames)
        setSavedReports((prev) => {
          const filtered = prev.filter((r) => r.fileName !== file.name);
          return [newReportItem, ...filtered];
        });
        setActiveReportIndex(0);
      } else {
        setError('Could not extract test biomarkers from this image/PDF. Please ensure the document is clear and readable.');
      }
    } catch (err) {
      console.error('[Upload Error]', err);
      setError('Failed to analyze the report. Please verify backend services are active and try again.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendChat = async (e, customPrompt) => {
    e?.preventDefault();
    const q = (customPrompt || chatInput).trim();
    if (!q || chatLoading || !activeReport) return;

    const userMsg = { id: Date.now(), sender: 'user', text: q };
    setChatMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setChatInput('');
    setChatLoading(true);

    try {
      const payload = {
        report_data: {
          patient_name: activeReport.patientName,
          lab_name: activeReport.labName,
          tests: activeReport.tests,
          summary: activeReport.summary,
          dietary_tips: activeReport.dietaryTips,
        },
        question: q,
      };

      let answerText = '';

      try {
        const chatRes = await axios.post('/api/reports/chat', payload, { timeout: 15000 });
        if (chatRes.data?.success && chatRes.data?.answer) {
          answerText = chatRes.data.answer;
        }
      } catch {
        // Direct to port 8000
        const directRes = await axios.post('http://localhost:8000/api/reports/chat', payload, { timeout: 15000 });
        if (directRes.data?.success && directRes.data?.answer) {
          answerText = directRes.data.answer;
        }
      }

      const aiMsg = {
        id: Date.now() + 1,
        sender: 'system',
        text: answerText || 'Please discuss these specific parameters with your physician for an individualized care plan.',
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'system',
          text: 'Consult your attending physician to evaluate these test results in clinical context.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'low':
        return { label: 'Low', cls: 'text-amber-600 font-medium' };
      case 'high':
        return { label: 'High', cls: 'text-red-500 font-medium' };
      case 'critical':
        return { label: 'Critical', cls: 'text-rose-700 font-bold' };
      default:
        return { label: 'Normal', cls: 'text-[#0f766e] font-medium' };
    }
  };

  return (
    <div className="w-full max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload diagnostic blood, CBC, biochemistry, or urine reports (PDF or image).
          </p>
        </div>

        {/* Local RAM Report Selector Pills */}
        {savedReports.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-md">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1 shrink-0">
              <History className="w-3.5 h-3.5" /> RAM History:
            </span>
            {savedReports.map((r, idx) => (
              <button
                key={r.id}
                onClick={() => setActiveReportIndex(idx)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors shrink-0 flex items-center gap-1 ${
                  activeReportIndex === idx
                    ? 'bg-[#0f766e] text-white font-medium shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title={r.fileName}
              >
                <span className="truncate max-w-[120px]">{r.fileName}</span>
                <span className="text-[10px] opacity-75">({r.tests?.length || 0})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
      />

      {/* Main Grid: Left Side (Report Details) & Right Side (Chat Assistant) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: 7 Cols (or 12 if no report yet) */}
        <div className={activeReport ? 'lg:col-span-7 space-y-6' : 'lg:col-span-12'}>
          {/* Upload Dropzone (shown if no reports in RAM, or as replacement trigger) */}
          {!activeReport && !loading && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-14 flex flex-col items-center justify-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/20 transition-all group bg-white shadow-xs"
            >
              <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Upload className="w-7 h-7 text-[#0f766e]" />
              </div>
              <p className="text-sm font-semibold text-slate-700 group-hover:text-[#0f766e]">
                Click or drop your lab report here
              </p>
              <p className="text-xs text-slate-400 mt-1">Supports JPG, PNG, WEBP, and PDF medical reports</p>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="bg-white border border-slate-200 rounded-xl p-12 flex flex-col items-center gap-3 shadow-xs">
              <Loader2 className="w-8 h-8 animate-spin text-[#0f766e]" />
              <p className="text-sm text-slate-800 font-semibold">Analyzing report with AI Vision...</p>
              <p className="text-xs text-slate-400">Extracting all test biomarkers, values, and reference ranges</p>
            </div>
          )}

          {/* Error Message */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="text-xs text-red-700">
                <p className="font-semibold">{error}</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1.5 text-red-700 underline font-medium"
                >
                  Try uploading another file
                </button>
              </div>
            </div>
          )}

          {/* Active Report Table & Narrative */}
          {activeReport && !loading && (
            <>
              {/* Report Header Card */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#0f766e]" />
                    <span className="text-sm font-semibold text-slate-800 truncate max-w-[220px]">
                      {activeReport.fileName}
                    </span>
                    <span className="text-xs text-slate-500">· {activeReport.tests.length} biomarkers found</span>
                  </div>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-xs"
                  >
                    Upload another report
                  </button>
                </div>

                {/* Patient/Lab Metadata if present */}
                {(activeReport.patientName || activeReport.labName) && (
                  <div className="px-5 py-2.5 bg-slate-50/30 border-b border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    {activeReport.patientName && (
                      <span>
                        <strong className="text-slate-700">Patient:</strong> {activeReport.patientName}
                      </span>
                    )}
                    {activeReport.labName && (
                      <span>
                        <strong className="text-slate-700">Laboratory:</strong> {activeReport.labName}
                      </span>
                    )}
                  </div>
                )}

                {/* Biomarkers Table */}
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200/80 z-10">
                      <tr className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-5">Test</th>
                        <th className="py-2.5 px-5">Value</th>
                        <th className="py-2.5 px-5">Normal Range</th>
                        <th className="py-2.5 px-5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeReport.tests.map((item, idx) => {
                        const { label, cls } = getStatusStyle(item.status);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-5 text-slate-800 font-medium text-xs">{item.test}</td>
                            <td className="py-3 px-5 text-slate-800 font-mono text-xs">{item.value}</td>
                            <td className="py-3 px-5 text-slate-500 text-xs">{item.normal_range || '—'}</td>
                            <td className={`py-3 px-5 text-xs ${cls}`}>{label}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              {activeReport.summary && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                  <div className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#0f766e]" /> Clinical Summary
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {activeReport.summary}
                  </p>
                </div>
              )}

              {/* Dietary Tips */}
              {activeReport.dietaryTips && (
                <div className="bg-teal-50/60 border border-teal-100 rounded-xl p-5 shadow-xs">
                  <div className="font-bold text-[#0f766e] text-sm mb-2">💡 Dietary & Lifestyle Tips</div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{activeReport.dietaryTips}</p>
                </div>
              )}
            </>
          )}

          <p className="text-xs text-slate-400 mt-6">For awareness only. Not a medical diagnosis.</p>
        </div>

        {/* Right Side: 5 Cols (AI Report Chat Assistant - same clean look as Ask section) */}
        {activeReport && (
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col h-[650px] sticky top-4">
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#0f766e]" />
                <span className="font-bold text-slate-900 text-sm">Report Assistant</span>
              </div>
              <span className="text-[11px] bg-teal-50 text-[#0f766e] border border-teal-100 px-2 py-0.5 rounded-md font-medium">
                Grounded in Report
              </span>
            </div>

            {/* Quick Prompt Chips */}
            <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto text-[11px]">
              <button
                type="button"
                onClick={(e) => handleSendChat(e, 'Explain my abnormal test values in simple terms.')}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
              >
                Abnormal values?
              </button>
              <button
                type="button"
                onClick={(e) => handleSendChat(e, 'What diet and lifestyle changes are recommended for these results?')}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
              >
                Diet plan
              </button>
              <button
                type="button"
                onClick={(e) => handleSendChat(e, 'Should I visit a doctor based on these findings?')}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
              >
                See a doctor?
              </button>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg) =>
                msg.sender === 'user' ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="bg-[#0f766e] text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-xs sm:text-sm font-normal max-w-[85%] shadow-xs">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-start">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 max-w-[92%] shadow-xs">
                      <div className="text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#0f766e]" /> HealthAssist
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">{msg.text}</p>
                    </div>
                  </div>
                )
              )}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center gap-2 text-xs text-slate-500 shadow-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0f766e]" />
                    <span>Analyzing report findings...</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Bar */}
            <form onSubmit={handleSendChat} className="p-3 border-t border-slate-100 bg-white flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about your report..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition-colors"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="bg-[#0f766e] hover:bg-[#115e59] disabled:opacity-50 text-white p-2 rounded-lg transition-colors flex items-center justify-center shrink-0 shadow-xs"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
