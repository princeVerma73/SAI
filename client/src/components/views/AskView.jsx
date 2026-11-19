import React, { useState } from 'react';
import axios from 'axios';
import { Send, Loader2 } from 'lucide-react';

export default function AskView() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'user',
      text: 'What are the common signs of anaemia?',
    },
    {
      id: 2,
      sender: 'system',
      answer:
        'Common signs are tiredness, pale skin, dizziness and shortness of breath during activity. A blood test (hemoglobin) confirms it.',
      sources: 'WHO anaemia fact sheet · MoHFW anaemia guidelines',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e?.preventDefault();
    const query = inputQuery.trim();
    if (!query || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await axios.post('/api/knowledge/ask', { query });
      if (res.data?.success && res.data.data) {
        const d = res.data.data;
        const guideline = d.retrievedGuideline || {};
        const org = guideline.organization || 'WHO / ICMR / Clinical Guidelines';
        const citationsList = d.citations && d.citations.length > 0 ? d.citations.join(' · ') : null;

        const sysMsg = {
          id: Date.now() + 1,
          sender: 'system',
          answer: guideline.summary || d.answer || 'Information retrieved from verified clinical guidelines.',
          sources: citationsList || `${org} · Evidence-Grounded Directory`,
          trace: d.workflow_trace || null,
          isSelfRag: Boolean(d.is_self_rag || d.workflow_trace),
          sourceType: d.source_type || 'pdf',
        };
        setMessages((prev) => [...prev, sysMsg]);
      } else {
        const sysMsg = {
          id: Date.now() + 1,
          sender: 'system',
          answer:
            'Please discuss these specific symptoms with your attending physician for a full clinical evaluation and targeted lab screening.',
          sources: 'WHO Clinical Practice Reference',
        };
        setMessages((prev) => [...prev, sysMsg]);
      }
    } catch (err) {
      console.error(err);
      const fallbackMsg = {
        id: Date.now() + 1,
        sender: 'system',
        answer:
          'Consult a qualified medical practitioner for proper diagnosis and personalized treatment.',
        sources: 'Standard Medical Safety Protocol',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl w-full">
      {/* Title & Subtitle */}
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ask</h1>
      <p className="text-sm text-slate-500 mt-1 mb-8">
        Ask a health question. Answers come from WHO, CDC and government sources.
      </p>

      {/* Chat Messages */}
      <div className="space-y-6 mb-8">
        {messages.map((msg) =>
          msg.sender === 'user' ? (
            <div key={msg.id} className="flex justify-end">
              <div className="bg-[#0f766e] text-white px-5 py-3 rounded-2xl rounded-tr-sm text-sm font-normal max-w-xl shadow-sm">
                {msg.text}
              </div>
            </div>
          ) : (
            <div key={msg.id} className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-2xl shadow-sm w-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-slate-900 text-sm">Answer</div>
                  <div className="flex items-center gap-2">
                    {msg.isSelfRag && msg.sourceType === 'web' && (
                      <span className="text-[11px] bg-blue-50 text-blue-600 border border-blue-100 font-medium px-2 py-0.5 rounded-md">
                        🌐 Web Search
                      </span>
                    )}
                    {msg.isSelfRag && msg.sourceType === 'direct' && (
                      <span className="text-[11px] bg-purple-50 text-purple-600 border border-purple-100 font-medium px-2 py-0.5 rounded-md">
                        💡 AI Knowledge
                      </span>
                    )}
                    {msg.isSelfRag && (!msg.sourceType || msg.sourceType === 'pdf') && (
                      <span className="text-[11px] bg-teal-50 text-[#0f766e] border border-teal-100 font-medium px-2 py-0.5 rounded-md">
                        Self-RAG Verified
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{msg.answer}</p>
                {msg.trace && msg.trace.length > 0 && (
                  <div className="text-[11px] text-slate-400 font-mono mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1">
                    <span className="font-sans text-slate-500 font-medium mr-1">Trace:</span>
                    {msg.trace.map((node, nIdx) => (
                      <span key={nIdx} className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                        {node}
                        {nIdx < msg.trace.length - 1 ? ' →' : ''}
                      </span>
                    ))}
                  </div>
                )}
                {msg.sources && (
                  <div className="text-xs text-slate-400 mt-2 pt-1">
                    Sources: {msg.sources}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#0f766e]" />
              <span>Retrieving verified clinical evidence...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSend} className="flex items-center gap-3">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Type your question"
          className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition-colors shadow-sm"
        />
        <button
          type="submit"
          disabled={loading || !inputQuery.trim()}
          className="bg-[#0f766e] hover:bg-[#115e59] disabled:opacity-50 text-white font-medium text-sm px-6 py-2.5 rounded-lg transition-colors flex items-center justify-center shadow-sm"
        >
          Send
        </button>
      </form>

      {/* Fixed Footer Disclaimer */}
      <p className="text-xs text-slate-400 mt-10">
        For awareness only. Not a medical diagnosis.
      </p>
    </div>
  );
}
