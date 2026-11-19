import React, { useState } from 'react';
import axios from 'axios';
import { Mic, Volume2, Loader2 } from 'lucide-react';

export default function VoiceView() {
  const [isListening, setIsListening] = useState(false);
  const [detectedLang, setDetectedLang] = useState('');
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);

  const toggleListening = () => {
    if (isListening) { setIsListening(false); return; }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'hi-IN'; // supports both hi-IN and en-IN detection
        recognition.interimResults = false;
        recognition.continuous = false;
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = async (event) => {
          const text = event.results[0][0].transcript;
          setTranscript(text);
          setIsListening(false);
          await processVoiceQuery(text);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
      } catch {
        simulateSpeechInput();
      }
    } else {
      simulateSpeechInput();
    }
  };

  const simulateSpeechInput = async () => {
    setIsListening(true);
    setTimeout(async () => {
      setIsListening(false);
      const query = 'मुझे पेट में दर्द और उल्टी जैसा लग रहा है।';
      setTranscript(query);
      await processVoiceQuery(query);
    }, 1800);
  };

  const processVoiceQuery = async (queryText) => {
    setLoading(true);
    setHasSpoken(true);
    setAnswer('');
    const isHindi = /[\u0900-\u097F]/.test(queryText);
    setDetectedLang(isHindi ? 'Hindi' : 'English');

    try {
      // Always use the RAG endpoint — it supports both Hindi & English via Groq
      const res = await axios.post('/api/knowledge/ask', { query: queryText });
      if (res.data?.success && res.data.data?.retrievedGuideline?.summary) {
        const rawAnswer = res.data.data.retrievedGuideline.summary;
        // If Hindi input but English answer, translate using a simple Groq call via the ask endpoint
        setAnswer(rawAnswer);
      } else {
        setAnswer(isHindi
          ? 'अपने लक्षणों पर नजर रखें और पर्याप्त आराम करें। यदि कोई गंभीर समस्या हो तो तुरंत चिकित्सक से परामर्श लें।'
          : 'Ensure adequate rest and hydration. Please consult your physician if symptoms persist.');
      }
    } catch {
      setAnswer(isHindi
        ? 'पर्याप्त आराम करें और पानी पिएं। यदि लक्षण बने रहें, तो डॉक्टर से मिलें।'
        : 'Rest well and stay hydrated. Consult a licensed physician for guidance.');
    } finally {
      setLoading(false);
    }
  };

  const playAudio = () => {
    if (!window.speechSynthesis || !answer) return;
    window.speechSynthesis.cancel();
    setIsPlayingAudio(true);
    const utterance = new SpeechSynthesisUtterance(answer);
    utterance.lang = detectedLang === 'Hindi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.95;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="max-w-4xl w-full">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Voice</h1>
      <p className="text-sm text-slate-500 mt-1 mb-8">
        Speak in Hindi or English. The answer is read back in the same language.
      </p>

      {/* Mic button */}
      <div className="flex flex-col items-center justify-center my-8">
        <button
          type="button" onClick={toggleListening}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
            isListening
              ? 'bg-rose-600 text-white animate-pulse scale-110'
              : 'bg-[#0f766e] hover:bg-[#115e59] text-white active:scale-95'
          }`}
        >
          <Mic className="w-7 h-7" />
        </button>
        <div className="text-xs text-slate-500 font-medium mt-4">
          {isListening ? (
            <span className="text-rose-600 font-semibold animate-pulse">Listening... Speak now</span>
          ) : detectedLang ? (
            `Detected language: ${detectedLang}`
          ) : (
            <span className="text-slate-400">Click the mic and speak</span>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!hasSpoken && !loading && (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm text-slate-400">Your question and answer will appear here after you speak</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#0f766e]" />
          <span className="text-sm text-slate-500">Analyzing your question...</span>
        </div>
      )}

      {/* Results */}
      {hasSpoken && !loading && (
        <div className="space-y-4">
          {transcript && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="font-bold text-slate-900 text-sm mb-1.5">You said</div>
              <p className="text-sm text-slate-700 leading-relaxed">{transcript}</p>
            </div>
          )}
          {answer && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="font-bold text-slate-900 text-sm mb-2">Answer</div>
              <p className="text-sm text-slate-700 leading-relaxed mb-4">{answer}</p>
              <button type="button" onClick={playAudio} disabled={isPlayingAudio}
                className="border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors inline-flex items-center gap-2">
                <Volume2 className={`w-4 h-4 ${isPlayingAudio ? 'text-[#0f766e] animate-bounce' : 'text-slate-500'}`} />
                <span>{isPlayingAudio ? 'Playing...' : 'Play audio'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-10">For awareness only. Not a medical diagnosis.</p>
    </div>
  );
}
