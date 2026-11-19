import React, { useState } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

export default function RiskAndPlanView() {
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [sleep, setSleep] = useState('');
  const [exercise, setExercise] = useState('');
  const [familyHistory, setFamilyHistory] = useState('None');
  const [loading, setLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const [scores, setScores] = useState({ diabetes: 0, heartDisease: 0, hypertension: 0 });
  const [plan, setPlan] = useState({ diet: '', exercise: '', sleep: '', water: '' });

  const handleCalculate = async (e) => {
    e?.preventDefault();
    if (!age || !weight || !sleep || !exercise) return;
    setLoading(true);

    const parsedAge = parseInt(age, 10);
    const parsedWeight = parseFloat(weight);
    const parsedSleep = parseFloat(sleep);
    const parsedExDays = parseInt(exercise, 10);

    try {
      const res = await axios.post('/api/risk/evaluate', {
        age: parsedAge,
        weight_kg: parsedWeight,
        sleep_hours_per_night: parsedSleep,
        exercise_minutes_per_week: parsedExDays * 30,
        family_history_diabetes: familyHistory === 'Diabetes',
        family_history_heart_disease: familyHistory === 'Heart disease',
        family_history_hypertension: familyHistory === 'Hypertension',
      });

      if (res.data?.success && res.data.data) {
        const d = res.data.data;
        setScores({
          diabetes: Math.min(Math.round(d.diabetesRisk?.riskPercentage ?? computeDiabetes(parsedAge, parsedWeight, parsedSleep, parsedExDays, familyHistory)), 99),
          heartDisease: Math.min(Math.round(d.cardiovascularRisk?.tenYearRiskPercentage ?? computeHeart(parsedAge, parsedWeight, parsedSleep, parsedExDays, familyHistory)), 99),
          hypertension: Math.min(Math.round(d.hypertensionRisk?.riskPercentage ?? computeHyp(parsedAge, parsedWeight, parsedSleep, parsedExDays, familyHistory)), 99),
        });
        const p = d.preventionPlan?.pillars || {};
        setPlan({
          diet: p.nutrition?.keyGuideline || generateDiet(familyHistory, parsedWeight),
          exercise: p.exercise?.prescriptionText || generateExercise(parsedExDays),
          sleep: p.circadian?.sleepTarget || generateSleep(parsedSleep),
          water: p.hydration?.targetSummary || `about ${(parsedWeight * 0.033).toFixed(1)} litres a day.`,
        });
      }
    } catch {
      // Pure local formula fallback
      setScores({
        diabetes: computeDiabetes(parsedAge, parsedWeight, parsedSleep, parsedExDays, familyHistory),
        heartDisease: computeHeart(parsedAge, parsedWeight, parsedSleep, parsedExDays, familyHistory),
        hypertension: computeHyp(parsedAge, parsedWeight, parsedSleep, parsedExDays, familyHistory),
      });
      setPlan({
        diet: generateDiet(familyHistory, parsedWeight),
        exercise: generateExercise(parsedExDays),
        sleep: generateSleep(parsedSleep),
        water: `about ${(parsedWeight * 0.033).toFixed(1)} litres a day.`,
      });
    } finally {
      setCalculated(true);
      setLoading(false);
    }
  };

  // ── Local risk formulas ────────────────────────────────────────────────────
  const computeDiabetes = (age, wt, sl, ex, fh) => {
    const bmi = wt / ((age > 0 ? Math.max(1.5, age * 0.009 + 1.6) : 1.7) ** 2);
    let r = age * 0.6 + (bmi > 25 ? (bmi - 25) * 2.5 : 0) + (sl < 6 ? 8 : 0) + (ex < 3 ? 7 : 0) + (fh === 'Diabetes' ? 20 : 0);
    return Math.min(Math.max(Math.round(r), 10), 92);
  };
  const computeHeart = (age, wt, sl, ex, fh) => {
    let r = age * 0.5 + (wt > 85 ? 10 : 0) + (sl < 6 ? 6 : 0) + (ex < 2 ? 10 : 0) + (fh === 'Heart disease' ? 22 : 0);
    return Math.min(Math.max(Math.round(r), 8), 88);
  };
  const computeHyp = (age, wt, sl, ex, fh) => {
    let r = age * 0.55 + (wt > 80 ? 8 : 0) + (sl < 6 ? 7 : 0) + (ex < 2 ? 8 : 0) + (fh === 'Hypertension' ? 22 : 0);
    return Math.min(Math.max(Math.round(r), 10), 90);
  };

  // ── Local plan generators ──────────────────────────────────────────────────
  const generateDiet = (fh, wt) => {
    if (fh === 'Diabetes') return 'cut sugary drinks and refined carbs; add dal, chana, leafy greens and whole grains.';
    if (fh === 'Heart disease') return 'reduce saturated fats and salt; eat fish, nuts, oats and plenty of vegetables.';
    if (fh === 'Hypertension') return 'cut salt below 5g/day; eat bananas, spinach, curd and low-sodium foods.';
    return wt > 85 ? 'reduce processed food and added sugar; eat high-fibre vegetables, lentils and lean protein.' : 'maintain a balanced diet with fruits, vegetables, whole grains and adequate protein.';
  };
  const generateExercise = (exDays) => {
    if (exDays === 0) return '30-minute brisk walk daily to start; gradually build up to 5 days a week.';
    if (exDays < 3) return '30-minute brisk walk or cycling, aim for at least 5 days a week.';
    return 'keep up your current routine; add strength training 2× per week for extra benefit.';
  };
  const generateSleep = (sl) => {
    if (sl < 6) return 'aim for 7–8 hours; set a fixed sleep and wake time, avoid screens 30 mins before bed.';
    if (sl > 9) return 'aim for 7–8 hours; oversleeping can also raise health risks — keep a consistent schedule.';
    return 'maintain your 7–8 hour schedule with a consistent bedtime.';
  };

  // ── Bar color based on risk level ─────────────────────────────────────────
  const barColor = (pct) => pct >= 70 ? 'bg-red-500' : pct >= 45 ? 'bg-amber-500' : 'bg-[#0f766e]';

  return (
    <div className="max-w-4xl w-full">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Risk and plan</h1>
      <p className="text-sm text-slate-500 mt-1 mb-8">
        Enter your details to see future risk and a prevention plan.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left: Form */}
        <form onSubmit={handleCalculate} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          {[
            { label: 'Age', val: age, set: setAge, type: 'number', placeholder: 'e.g. 34' },
            { label: 'Weight (kg)', val: weight, set: setWeight, type: 'number', placeholder: 'e.g. 72' },
            { label: 'Sleep (hours/night)', val: sleep, set: setSleep, type: 'number', step: '0.5', placeholder: 'e.g. 6.5' },
            { label: 'Exercise (days per week)', val: exercise, set: setExercise, type: 'number', placeholder: '0–7' },
          ].map(({ label, val, set, type, step, placeholder }) => (
            <div key={label}>
              <label className="text-xs text-slate-500 font-medium mb-1.5 block">{label}</label>
              <input
                type={type} step={step} value={val} onChange={(e) => set(e.target.value)}
                placeholder={placeholder} required
                className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition-colors"
              />
            </div>
          ))}

          <div>
            <label className="text-xs text-slate-500 font-medium mb-1.5 block">Family history</label>
            <select value={familyHistory} onChange={(e) => setFamilyHistory(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition-colors">
              <option>None</option>
              <option>Diabetes</option>
              <option>Heart disease</option>
              <option>Hypertension</option>
            </select>
          </div>

          <div className="pt-2">
            <button type="submit" disabled={loading}
              className="w-full bg-[#0f766e] hover:bg-[#115e59] text-white font-medium text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center shadow-sm disabled:opacity-60">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Computing...</> : 'Calculate'}
            </button>
          </div>
        </form>

        {/* Right: Results */}
        <div className="space-y-6">
          {!calculated ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-10 flex flex-col items-center justify-center text-center">
              <p className="text-sm text-slate-400 font-medium">Fill in your details and click Calculate</p>
              <p className="text-xs text-slate-300 mt-1">Risk scores and your personal prevention plan will appear here</p>
            </div>
          ) : (
            <>
              {/* Risk scores */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="font-bold text-slate-900 text-sm mb-4">Risk score</div>
                <div className="space-y-4">
                  {[
                    { label: 'Diabetes', value: scores.diabetes },
                    { label: 'Heart disease', value: scores.heartDisease },
                    { label: 'Hypertension', value: scores.hypertension },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="flex justify-between items-center text-sm text-slate-700 mb-1.5">
                        <span>{label}</span>
                        <span className="font-bold text-slate-900">{value}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className={`${barColor(value)} h-full rounded-full transition-all duration-700 ease-out`}
                          style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prevention plan */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="font-bold text-slate-900 text-sm mb-3">Prevention plan</div>
                <div className="space-y-2 text-sm text-slate-700 leading-relaxed">
                  {plan.diet && <p><strong className="text-slate-900">Diet</strong> – {plan.diet}</p>}
                  {plan.exercise && <p><strong className="text-slate-900">Exercise</strong> – {plan.exercise}</p>}
                  {plan.sleep && <p><strong className="text-slate-900">Sleep</strong> – {plan.sleep}</p>}
                  {plan.water && <p><strong className="text-slate-900">Water</strong> – {plan.water}</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-10">For awareness only. Not a medical diagnosis.</p>
    </div>
  );
}
