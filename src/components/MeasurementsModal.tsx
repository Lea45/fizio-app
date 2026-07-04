import { useState } from "react";
import "../styles/measurements.css";

export type MeasurementEntry = {
  date: string;
  weight?: number;
  muscleMass?: number;
  fatMass?: number;
  bmr?: number;
  vo2max?: number;
  biologicalAge?: number;
};

export type CircumferenceEntry = {
  date: string;
  chest?: number;
  waist?: number;
  hips?: number;
  bicep?: number;
  thigh?: number;
};

export type CircumferenceGoals = {
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  bicep?: number | null;
  thigh?: number | null;
};

type TrendMetric = "weight" | "muscle" | "fat" | "bmr" | "vo2";
type CircKey = "chest" | "waist" | "hips" | "bicep" | "thigh";

const CIRC_LABELS: Record<CircKey, string> = {
  chest: "Prsa",
  waist: "Struk",
  hips: "Kukovi",
  bicep: "Nadlaktica",
  thigh: "Natkoljenica",
};

const CIRC_POINTS: Record<CircKey, { cx: number; cy: number }> = {
  chest:  { cx: 50, cy: 62  },
  waist:  { cx: 50, cy: 90  },
  hips:   { cx: 50, cy: 115 },
  bicep:  { cx: 81, cy: 74  },
  thigh:  { cx: 66, cy: 150 },
};

const TREND_LABELS: Record<TrendMetric, string> = {
  weight: "kg",
  muscle: "Miš.",
  fat: "Mas.",
  bmr: "BMR",
  vo2: "VO2",
};

function parseDateMs(s: string): number {
  const parts = s.split(".");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts.map(p => parseInt(p.trim(), 10));
    return new Date(yyyy, mm - 1, dd).getTime();
  }
  return new Date(s).getTime() || 0;
}

function sortByDate<T extends { date: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => parseDateMs(a.date) - parseDateMs(b.date));
}

function getVO2Category(vo2: number, gender: string, age: number): { label: string; color: string } {
  const tables: Record<string, Record<string, number[]>> = {
    F: { "20": [28,34,39,45,50], "30": [27,32,37,43,49], "40": [25,30,35,41,45], "50": [21,25,30,35,40] },
    M: { "20": [38,44,49,56,61], "30": [34,39,44,51,56], "40": [30,35,40,46,52], "50": [25,30,35,41,46] },
  };
  const g = gender === "M" ? "M" : "F";
  const decade = age < 30 ? "20" : age < 40 ? "30" : age < 50 ? "40" : "50";
  const norms = tables[g][decade];
  const labels = ["Loše", "Ispodprosjeka", "Prosječno", "Dobro", "Odlično", "Superiorno"];
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#8b5cf6"];
  const idx = norms.findIndex(n => vo2 < n);
  const i = idx === -1 ? 5 : idx;
  return { label: labels[i], color: colors[i] };
}

function calcDelta(cur?: number, first?: number): number | null {
  if (cur == null || first == null) return null;
  return +( cur - first).toFixed(1);
}

function deltaClass(d: number | null, positiveIsGood = true): string {
  if (d == null || d === 0) return "zero";
  const isGood = positiveIsGood ? d > 0 : d < 0;
  return isGood ? "pos" : "neg";
}

function formatDelta(d: number | null, unit = ""): string {
  if (d == null) return "";
  return (d > 0 ? "+" : "") + d + unit;
}

// --- Simple SVG line chart ---
function LineChart({ data, color = "#22c55e" }: { data: { date: string; value: number }[]; color?: string }) {
  if (data.length < 2) {
    return <p className="m-chart-empty">Nedovoljno podataka za grafikon.</p>;
  }

  const W = 300, H = 100;
  const P = { t: 10, r: 8, b: 24, l: 36 };
  const iW = W - P.l - P.r;
  const iH = H - P.t - P.b;

  const vals = data.map(d => d.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV === minV ? 1 : maxV - minV;

  const xS = (i: number) => P.l + (i / (data.length - 1)) * iW;
  const yS = (v: number) => P.t + iH - ((v - minV) / range) * iH;
  const pts = data.map((d, i) => `${xS(i)},${yS(d.value)}`).join(" ");

  const step = Math.ceil(data.length / 5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="m-chart-svg">
      {[0, 0.5, 1].map(t => (
        <line key={t}
          x1={P.l} x2={W - P.r}
          y1={P.t + iH * (1 - t)} y2={P.t + iH * (1 - t)}
          stroke="rgba(255,255,255,0.07)" strokeWidth="1"
        />
      ))}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={xS(i)} cy={yS(d.value)} r="2.5" fill={color} />
      ))}
      {data.map((d, i) => {
        if (i % step !== 0 && i !== data.length - 1) return null;
        const parts = d.date.split(".");
        const lbl = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : d.date;
        return (
          <text key={i} x={xS(i)} y={H - 4} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7">
            {lbl}
          </text>
        );
      })}
      <text x={P.l - 3} y={P.t + 5} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="7">{maxV.toFixed(1)}</text>
      <text x={P.l - 3} y={P.t + iH + 1} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="7">{minV.toFixed(1)}</text>
    </svg>
  );
}

// --- Body silhouette ---
function BodySilhouette({ active, onSelect }: { active: CircKey | null; onSelect: (k: CircKey) => void }) {
  return (
    <svg viewBox="0 0 100 210" className="m-silhouette">
      <circle cx="50" cy="18" r="14" className="sil-shape" />
      <rect x="44" y="32" width="12" height="8" className="sil-shape" />
      <path d="M28,40 C26,55 24,76 22,105 L22,130 C22,132 24,134 26,134 L74,134 C76,134 78,132 78,130 L78,105 C76,76 74,55 72,40 Z" className="sil-shape" />
      <path d="M28,45 C22,62 18,84 16,110 L22,112 C24,87 28,67 32,50 Z" className="sil-shape" />
      <path d="M72,45 C78,62 82,84 84,110 L78,112 C76,87 72,67 68,50 Z" className="sil-shape" />
      <path d="M26,134 L22,200 L38,200 L42,158 L46,134 Z" className="sil-shape" />
      <path d="M74,134 L78,200 L62,200 L58,158 L54,134 Z" className="sil-shape" />
      {(Object.keys(CIRC_POINTS) as CircKey[]).map(k => (
        <circle
          key={k}
          cx={CIRC_POINTS[k].cx}
          cy={CIRC_POINTS[k].cy}
          r={active === k ? 6.5 : 4.5}
          className={`sil-point${active === k ? " active" : ""}`}
          onClick={() => onSelect(k)}
        />
      ))}
    </svg>
  );
}

// --- Main component ---
type Props = {
  onClose: () => void;
  measurements: MeasurementEntry[];
  circumferences: CircumferenceEntry[];
  circumferenceGoals: CircumferenceGoals;
  gender: string;
  birthYear: number | null;
};

export default function MeasurementsModal({ onClose, measurements, circumferences, circumferenceGoals, gender, birthYear }: Props) {
  const [activeTab, setActiveTab] = useState<"composition" | "circumferences">("composition");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("weight");
  const [activeCirc, setActiveCirc] = useState<CircKey | null>(null);

  const sortedM = sortByDate(measurements);
  const sortedC = sortByDate(circumferences);
  const latest = sortedM[sortedM.length - 1];
  const first = sortedM[0];
  const latestC = sortedC[sortedC.length - 1];
  const firstC = sortedC[0];

  const age = birthYear ? new Date().getFullYear() - birthYear : null;

  const trendData: Record<TrendMetric, { date: string; value: number }[]> = {
    weight: sortedM.filter(m => m.weight != null).map(m => ({ date: m.date, value: m.weight! })),
    muscle: sortedM.filter(m => m.muscleMass != null).map(m => ({ date: m.date, value: m.muscleMass! })),
    fat:    sortedM.filter(m => m.fatMass != null).map(m => ({ date: m.date, value: m.fatMass! })),
    bmr:    sortedM.filter(m => m.bmr != null).map(m => ({ date: m.date, value: m.bmr! })),
    vo2:    sortedM.filter(m => m.vo2max != null).map(m => ({ date: m.date, value: m.vo2max! })),
  };

  const circTrend = activeCirc
    ? sortedC.filter(c => c[activeCirc] != null).map(c => ({ date: c.date, value: c[activeCirc]! as number }))
    : [];

  function circProgress(key: CircKey): number | null {
    const goal = circumferenceGoals[key];
    if (goal == null || !firstC || !latestC) return null;
    const start = firstC[key];
    const cur = latestC[key];
    if (start == null || cur == null) return null;
    const total = goal - start;
    if (Math.abs(total) < 0.01) return 100;
    return Math.max(0, Math.min(100, Math.round(((cur - start) / total) * 100)));
  }

  const vo2Latest = latest?.vo2max;
  const vo2Cat = vo2Latest != null && age != null ? getVO2Category(vo2Latest, gender, age) : null;

  const compositionCards: { key: TrendMetric; label: string; value?: number; firstVal?: number; unit: string; positiveIsGood: boolean }[] = [
    { key: "weight", label: "Težina",       value: latest?.weight,     firstVal: first?.weight,     unit: " kg",   positiveIsGood: false },
    { key: "muscle", label: "Mišićna masa", value: latest?.muscleMass, firstVal: first?.muscleMass, unit: " kg",   positiveIsGood: true  },
    { key: "fat",    label: "Masna masa",   value: latest?.fatMass,    firstVal: first?.fatMass,    unit: "%",     positiveIsGood: false },
    { key: "bmr",    label: "BMR",          value: latest?.bmr,        firstVal: first?.bmr,        unit: " kcal", positiveIsGood: true  },
  ];

  return (
    <div className="profile-history-overlay" onClick={onClose}>
      <div className="profile-history-modal m-modal" onClick={e => e.stopPropagation()}>

        <div className="profile-history-header">
          <h3>Mjerenje</h3>
          <button className="profile-history-close" onClick={onClose}>✕</button>
        </div>

        {/* Internal tabs */}
        <div className="m-tabs">
          <button className={`m-tab${activeTab === "composition" ? " active" : ""}`} onClick={() => setActiveTab("composition")}>
            Tjelesni sastav
          </button>
          <button className={`m-tab${activeTab === "circumferences" ? " active" : ""}`} onClick={() => setActiveTab("circumferences")}>
            Opsezi
          </button>
        </div>

        {/* ── TJELESNI SASTAV ── */}
        {activeTab === "composition" && (
          <div className="m-content">
            {!latest ? (
              <p className="profile-history-empty">Nema unesenih mjerenja.</p>
            ) : (
              <>
                {/* 2×2 grid */}
                <div className="m-grid">
                  {compositionCards.map(({ key, label, value, firstVal, unit, positiveIsGood }) => {
                    const d = calcDelta(value, firstVal);
                    return (
                      <div
                        key={key}
                        className={`m-card${trendMetric === key ? " selected" : ""}`}
                        onClick={() => setTrendMetric(key)}
                      >
                        <span className="m-card-label">{label}</span>
                        <span className="m-card-value">{value != null ? `${value}${unit}` : "-"}</span>
                        {d !== null && d !== 0 && (
                          <span className={`m-card-delta ${deltaClass(d, positiveIsGood)}`}>
                            {formatDelta(d, unit)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* VO2max wide card */}
                {latest.vo2max != null && (
                  <div className={`m-card m-card-wide${trendMetric === "vo2" ? " selected" : ""}`} onClick={() => setTrendMetric("vo2")}>
                    <div className="m-vo2-row">
                      <div className="m-vo2-left">
                        <span className="m-card-label">VO2max</span>
                        <span className="m-card-value">{latest.vo2max} <small>ml/kg/min</small></span>
                        {(() => { const d = calcDelta(latest.vo2max, first?.vo2max); return d !== null && d !== 0 ? (
                          <span className={`m-card-delta ${deltaClass(d, true)}`}>{formatDelta(d)}</span>
                        ) : null; })()}
                      </div>
                      {vo2Cat && (
                        <span className="m-vo2-cat" style={{ color: vo2Cat.color, borderColor: vo2Cat.color }}>
                          {vo2Cat.label}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Biološka dob wide card */}
                {latest.biologicalAge != null && latest.biologicalAge > 0 && age != null && (
                  <div className="m-card m-card-wide m-bio-card">
                    <div className="m-bio-row">
                      <div>
                        <span className="m-card-label">Biološka dob</span>
                        <span className="m-card-value">{latest.biologicalAge} god</span>
                      </div>
                      <div className="m-bio-diff">
                        <span className={`m-bio-num ${latest.biologicalAge < age ? "younger" : "older"}`}>
                          {latest.biologicalAge < age
                            ? `-${age - latest.biologicalAge}`
                            : `+${latest.biologicalAge - age}`}
                        </span>
                        <span className="m-bio-sub">
                          {latest.biologicalAge < age ? "mlađi od kronološke" : "stariji od kronološke"}
                        </span>
                      </div>
                    </div>
                    <div className="m-bio-chron">Kronološka dob: {age} god</div>
                  </div>
                )}

                {/* Trend selector */}
                <div className="m-trend-row">
                  {(Object.keys(TREND_LABELS) as TrendMetric[]).map(m => (
                    <button
                      key={m}
                      className={`m-trend-btn${trendMetric === m ? " active" : ""}`}
                      onClick={() => setTrendMetric(m)}
                    >
                      {TREND_LABELS[m]}
                    </button>
                  ))}
                </div>

                {/* Chart */}
                <div className="m-chart-wrap">
                  <LineChart data={trendData[trendMetric]} />
                </div>

                {/* Napredak od početka */}
                {first && sortedM.length > 1 && (
                  <div className="m-progress-section">
                    <p className="m-progress-title">Napredak od početka</p>
                    <div className="m-progress-grid">
                      {compositionCards.map(({ label, value, firstVal, unit, positiveIsGood }) => {
                        const d = calcDelta(value, firstVal);
                        if (d === null) return null;
                        return (
                          <div key={label} className="m-progress-item">
                            <span className="m-progress-label">{label}</span>
                            <span className={`m-progress-delta ${deltaClass(d, positiveIsGood)}`}>
                              {formatDelta(d, unit)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── OPSEZI ── */}
        {activeTab === "circumferences" && (
          <div className="m-content">
            {!latestC ? (
              <p className="profile-history-empty">Nema unesenih opsega.</p>
            ) : (
              <>
                <div className="m-circ-layout">
                  <div className="m-silhouette-wrap">
                    <BodySilhouette
                      active={activeCirc}
                      onSelect={k => setActiveCirc(prev => prev === k ? null : k)}
                    />
                  </div>

                  <div className="m-circ-list">
                    {(Object.keys(CIRC_LABELS) as CircKey[]).map(k => {
                      const val = latestC[k];
                      const goal = circumferenceGoals[k];
                      const prog = circProgress(k);
                      const isActive = activeCirc === k;
                      return (
                        <div
                          key={k}
                          className={`m-circ-item${isActive ? " active" : ""}`}
                          onClick={() => setActiveCirc(prev => prev === k ? null : k)}
                        >
                          <div className="m-circ-top">
                            <span className="m-circ-name">{CIRC_LABELS[k]}</span>
                            <span className="m-circ-val">{val != null ? `${val} cm` : "-"}</span>
                          </div>
                          {goal != null && (
                            <div className="m-circ-bar-row">
                              <div className="m-circ-bar">
                                <div className="m-circ-bar-fill" style={{ width: `${prog ?? 0}%` }} />
                              </div>
                              <span className="m-circ-goal">cilj: {goal} cm</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {activeCirc && (
                  <div className="m-chart-wrap">
                    <p className="m-chart-title">{CIRC_LABELS[activeCirc]} - trend</p>
                    <LineChart data={circTrend} color="#0ea5e9" />
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
