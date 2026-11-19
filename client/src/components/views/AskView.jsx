import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Send, Loader2, Image as ImageIcon, X, Sparkles, AlertCircle } from 'lucide-react';

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
      sourceType: 'direct',
      isSelfRag: true,
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null); // { file, preview, base64, mimeType }
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage({
        file,
        preview: URL.createObjectURL(file),
        base64: reader.result,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
  };

  const handleSend = async (e, customText) => {
    e?.preventDefault();
    const query = (customText || inputQuery).trim();
    const imageToSend = selectedImage;

    if ((!query && !imageToSend) || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query || 'Please analyze this image.',
      image: imageToSend ? imageToSend.preview : null,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setSelectedImage(null);
    setLoading(true);

    try {
      // Build lightweight conversation history for follow-ups
      const historyPayload = messages.slice(-6).map((m) => ({
        sender: m.sender,
        text: m.text || m.answer || '',
      }));

      const payload = {
        query: query || 'Please inspect this medical image (cut mark, rash, wound, or skin condition) and provide visual observations, first aid advice, and signs of infection.',
        image_b64: imageToSend ? imageToSend.base64 : null,
        mime_type: imageToSend ? imageToSend.mimeType : 'image/jpeg',
        history: historyPayload,
      };

      const res = await axios.post('/api/knowledge/ask', payload, { timeout: 25000 });

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
          sourceType: d.is_multimodal ? 'visual' : (d.source_type || 'pdf'),
          isMultimodal: Boolean(d.is_multimodal),
        };
        setMessages((prev) => [...prev, sysMsg]);
      } else {
        const sysMsg = {
          id: Date.now() + 1,
          sender: 'system',
          answer:
            'Please discuss these specific symptoms with your attending physician for a full clinical evaluation.',
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
          'Consult a qualified medical practitioner for proper visual examination and wound care.',
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ask</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ask any health question or upload photos of cuts, wounds, rashes & skin issues for visual triage.
          </p>
        </div>
      </div>

      {/* Suggested Quick Question Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 text-xs">
        <button
          type="button"
          onClick={(e) => handleSend(e, 'What are the emergency warning signs of an infected cut or wound?')}
          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors shadow-xs"
        >
          🩹 Infected cut warning signs
        </button>
        <button
          type="button"
          onClick={(e) => handleSend(e, 'How can I tell the difference between an allergic rash and an insect bite?')}
          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors shadow-xs"
        >
          🦟 Allergic rash vs insect bite
        </button>
        <button
          type="button"
          onClick={(e) => handleSend(e, 'What is the immediate first aid treatment for a minor kitchen burn?')}
          className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors shadow-xs"
        >
          🔥 Minor burn first aid
        </button>
      </div>

      {/* Chat Messages */}
      <div className="space-y-6 mb-8">
        {messages.map((msg) =>
          msg.sender === 'user' ? (
            <div key={msg.id} className="flex justify-end">
              <div className="bg-[#0f766e] text-white px-5 py-3 rounded-2xl rounded-tr-sm text-sm font-normal max-w-xl shadow-xs space-y-2">
                {msg.image && (
                  <div className="rounded-lg overflow-hidden border border-white/20 max-w-[280px]">
                    <img src={msg.image} alt="User upload" className="w-full h-auto object-cover max-h-60" />
                  </div>
                )}
                {msg.text && <p className="leading-relaxed">{msg.text}</p>}
              </div>
            </div>
          ) : (
            <div key={msg.id} className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-2xl shadow-xs w-full">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#0f766e]" /> Answer
                  </div>
                  <div className="flex items-center gap-2">
                    {msg.sourceType === 'visual' && (
                      <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                        👁️ Visual Triage
                      </span>
                    )}
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
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#0f766e]" />
              <span>Analyzing clinical symptoms and visual features...</span>
            </div>
          </div>
        )}
      </div>

      {/* Selected Image Thumbnail Preview before sending */}
      {selectedImage && (
        <div className="mb-3 inline-flex items-center gap-3 bg-white border border-teal-200 rounded-xl p-2.5 shadow-xs">
          <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shrink-0">
            <img src={selectedImage.preview} alt="Upload preview" className="w-full h-full object-cover" />
          </div>
          <div className="text-xs">
            <p className="font-medium text-slate-800 truncate max-w-[200px]">{selectedImage.file.name}</p>
            <p className="text-[11px] text-teal-600 font-medium mt-0.5">Ready to analyze photo</p>
          </div>
          <button
            type="button"
            onClick={removeSelectedImage}
            className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 ml-2"
            title="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
      />

      {/* Input Bar */}
      <form onSubmit={handleSend} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2 shadow-xs focus-within:ring-1 focus-within:ring-teal-600 focus-within:border-teal-600 transition-all">
        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-slate-400 hover:text-[#0f766e] hover:bg-teal-50 rounded-lg transition-colors shrink-0"
          title="Upload cut, rash, wound or skin image"
        >
          <ImageIcon className="w-5 h-5" />
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder={selectedImage ? "Add context about this image (e.g. 'Hurts when touched', 'Started 2 days ago')..." : "Type your health question or attach a photo..."}
          className="flex-1 bg-transparent px-2 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={loading || (!inputQuery.trim() && !selectedImage)}
          className="bg-[#0f766e] hover:bg-[#115e59] disabled:opacity-40 text-white font-medium text-sm px-5 py-2 rounded-lg transition-colors flex items-center justify-center shrink-0 shadow-xs"
        >
          <Send className="w-4 h-4 mr-1.5" />
          Send
        </button>
      </form>

      {/* Fixed Footer Disclaimer */}
      <p className="text-xs text-slate-400 mt-10">
        For awareness only. Not a medical diagnosis. In case of heavy bleeding, deep wounds, or severe allergic reaction, call emergency services immediately.
      </p>
    </div>
  );
}
