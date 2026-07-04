import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/profile.css";
import { FaPhone, FaUser, FaSignOutAlt, FaFolderOpen } from "react-icons/fa";
import MeasurementsModal, { type MeasurementEntry, type CircumferenceEntry, type CircumferenceGoals } from "./MeasurementsModal";

type PastSessionItem = {
  sessionId: string;
  date: string;
  time: string;
  createdAt?: any;
};

const PERIOD_WEEKS = { "1m": 4, "3m": 13, "6m": 26, "12m": 52 } as const;
type Period = keyof typeof PERIOD_WEEKS;

function parseDateStr(s: string): Date | null {
  if (!s) return null;
  const parts = s.split(".");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts.map((p) => parseInt(p.trim(), 10));
    if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) return new Date(yyyy, mm - 1, dd);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toMondayStr(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStats(history: PastSessionItem[], goal: number, period: Period) {
  const weeksCount = PERIOD_WEEKS[period];

  const today = new Date();
  const curWeekMon = new Date(today);
  const todayDay = today.getDay();
  curWeekMon.setDate(today.getDate() + (todayDay === 0 ? -6 : 1 - todayDay));
  curWeekMon.setHours(0, 0, 0, 0);
  const curWeekKey = toMondayStr(curWeekMon);

  const periodMon = addDays(curWeekMon, -(weeksCount - 1) * 7);
  const prevPeriodMon = addDays(periodMon, -weeksCount * 7);

  // Build all-time week map
  const allByWeek = new Map<string, number>();
  for (const s of history) {
    const d = parseDateStr(s.date);
    if (!d) continue;
    const key = toMondayStr(d);
    allByWeek.set(key, (allByWeek.get(key) || 0) + 1);
  }

  // Current period sessions
  const periodVisits = history.filter((s) => {
    const d = parseDateStr(s.date);
    return d && d >= periodMon;
  });

  // Previous period sessions
  const prevVisits = history.filter((s) => {
    const d = parseDateStr(s.date);
    return d && d >= prevPeriodMon && d < periodMon;
  });

  // Week squares for current period
  const weekSquares: { met: boolean; count: number }[] = [];
  for (let i = 0; i < weeksCount; i++) {
    const wMon = addDays(periodMon, i * 7);
    const count = allByWeek.get(toMondayStr(wMon)) || 0;
    weekSquares.push({ met: count >= goal, count });
  }

  const weeksMetGoal = weekSquares.filter((w) => w.met).length;
  const consistencyPct = weeksCount > 0 ? Math.round((weeksMetGoal / weeksCount) * 100) : 0;

  // Previous period consistency
  const prevByWeek = new Map<string, number>();
  for (const s of prevVisits) {
    const d = parseDateStr(s.date);
    if (!d) continue;
    const key = toMondayStr(d);
    prevByWeek.set(key, (prevByWeek.get(key) || 0) + 1);
  }
  const prevWeeksMetGoal = Array.from(prevByWeek.values()).filter((c) => c >= goal).length;
  const prevConsistencyPct = Math.round((prevWeeksMetGoal / weeksCount) * 100);
  const trend = consistencyPct - prevConsistencyPct;

  const avgPerWeek = weeksCount > 0 ? +(periodVisits.length / weeksCount).toFixed(1) : 0;
  const avgPerMonth = +((periodVisits.length / weeksCount) * 4.33).toFixed(1);

  // Streaks
  let currentStreak = 0;
  let recordStreak = 0;

  if (allByWeek.size > 0) {
    const allKeys = Array.from(allByWeek.keys()).sort();
    const firstMonDate = new Date(allKeys[0] + "T00:00:00");
    const lastWeekMon = addDays(curWeekMon, -7);

    // Record streak: walk from first week to last week
    let temp = 0;
    let d = new Date(firstMonDate);
    while (toMondayStr(d) <= toMondayStr(lastWeekMon)) {
      const count = allByWeek.get(toMondayStr(d)) || 0;
      if (count >= goal) {
        temp++;
        recordStreak = Math.max(recordStreak, temp);
      } else {
        temp = 0;
      }
      d = addDays(d, 7);
    }
    // Include current week in record if it already meets goal
    const curCount = allByWeek.get(curWeekKey) || 0;
    if (curCount >= goal) {
      temp++;
      recordStreak = Math.max(recordStreak, temp);
    }

    // Current streak: backwards from last week (or current if met)
    let startMon = new Date(curWeekMon);
    if ((allByWeek.get(curWeekKey) || 0) < goal) startMon = addDays(startMon, -7);
    while (true) {
      const count = allByWeek.get(toMondayStr(startMon)) || 0;
      if (count >= goal) {
        currentStreak++;
        startMon = addDays(startMon, -7);
      } else break;
    }
  }

  return {
    consistencyPct,
    prevConsistencyPct,
    trend,
    avgPerWeek,
    avgPerMonth,
    totalVisits: periodVisits.length,
    currentStreak,
    recordStreak,
    weekSquares,
    weeksMetGoal,
  };
}

function getMotivationalText(
  pct: number,
  trend: number,
  name: string,
  avgPerWeek: number,
  weeklyGoal: number,
  currentStreak: number,
  weeksMetGoal: number,
  weeksCount: number
): string {
  const n = name ? name.split(" ")[0] : "";
  const hey = n ? `${n}, ` : "";

  if (pct >= 85) {
    if (trend >= 0) {
      return `Izvrsno, ${n || "svaka čast"}! Ispunjavaš cilj u ${weeksMetGoal} od ${weeksCount} tjedana i dolaziš prosječno ${avgPerWeek}× tjedno. Savršen ritam - nastavi ovako!`;
    }
    return `${hey}${pct}% konzistentnost je izvrsno, ali malo je pala u odnosu na prethodni period. Cilj je ${weeklyGoal}× tjedno - drži ga!`;
  }

  if (pct >= 70) {
    if (currentStreak >= 3) {
      return `${hey}streak od ${currentStreak} tjedna govori da si u ritmu! Dolaziš prosječno ${avgPerWeek}× tjedno - još malo i konzistentnost prelazi 85%.`;
    }
    if (trend > 5) {
      return `${hey}u zadnjih ${weeksCount} tjedana ispunila si cilj u ${weeksMetGoal} od njih i trend raste. Još jedan korak do vrhunca!`;
    }
    return `${hey}prosjek ${avgPerWeek}× tjedno je solidan, ali cilj je ${weeklyGoal}×. Tjedan po tjedan - konzistentnost će porasti.`;
  }

  if (pct >= 50) {
    const diff = +(weeklyGoal - avgPerWeek).toFixed(1);
    if (trend > 0) {
      return `${hey}ide na bolje! Prosjek ti je ${avgPerWeek}× tjedno, a cilj je ${weeklyGoal}×. Razlika je samo ${diff} treninga - možeš to!`;
    }
    return `${hey}cilj je ${weeklyGoal}× tjedno, a prosjek je ${avgPerWeek}×. Samo jedan extra trening tjedno i sve se mijenja.`;
  }

  if (currentStreak >= 2) {
    return `${hey}streak od ${currentStreak} tjedna je dobar početak! Cilj je ${weeklyGoal}× tjedno - gradimo ritam korak po korak.`;
  }
  return `${hey}svaki dolazak se računa. Cilj je ${weeklyGoal}× tjedno - počni s jednim extra treningom i ritam će doći sam.`;
}

export default function Profile() {
  const storedPhone = localStorage.getItem("phone");
  const [phone] = useState(storedPhone || "");

  const [name, setName] = useState("");
  const [remainingVisits, setRemainingVisits] = useState<number | null>(null);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState<number>(2);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("1m");
  const [measurements, setMeasurements] = useState<MeasurementEntry[]>([]);
  const [circumferences, setCircumferences] = useState<CircumferenceEntry[]>([]);
  const [circumferenceGoals, setCircumferenceGoals] = useState<CircumferenceGoals>({});
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState<number | null>(null);

  const [showExercisesModal, setShowExercisesModal] = useState(false);
  const [showStatisticsModal, setShowStatisticsModal] = useState(false);
  const [showMeasurementsModal, setShowMeasurementsModal] = useState(false);

  const [history, setHistory] = useState<PastSessionItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    const ref = doc(db, "users", userId);

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setName("");
        setRemainingVisits(null);
        setNoteTitle("");
        setNoteBody("");
        setHistory([]);
        return;
      }

      const userData = snap.data() as any;

      setName(userData.name || "");
      setRemainingVisits(userData.remainingVisits ?? null);
      setNoteTitle(userData.noteTitle || "");
      setNoteBody(userData.noteBody || "");
      setWeeklyGoal(userData.weeklyGoal ?? 2);
      setMeasurements(Array.isArray(userData.measurements) ? userData.measurements : []);
      setCircumferences(Array.isArray(userData.circumferences) ? userData.circumferences : []);
      setCircumferenceGoals(userData.circumferenceGoals ?? {});
      setGender(userData.gender ?? "");
      setBirthYear(userData.birthYear ?? null);

      const past: PastSessionItem[] = Array.isArray(userData.pastSessions)
        ? userData.pastSessions
        : [];

      const toMs = (v: any) => {
        if (!v) return 0;
        if (typeof v === "number") return v;
        if (typeof v?.toMillis === "function") return v.toMillis();
        return 0;
      };

      const sorted = [...past].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
      setHistory(sorted);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("phone");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    window.location.reload();
  };

  const handleWeeklyGoalChange = async (delta: number) => {
    const newGoal = Math.max(1, Math.min(7, weeklyGoal + delta));
    setWeeklyGoal(newGoal);
    const userId = localStorage.getItem("userId");
    if (userId) await updateDoc(doc(db, "users", userId), { weeklyGoal: newGoal });
  };

  const stats = useMemo(
    () => computeStats(history, weeklyGoal, selectedPeriod),
    [history, weeklyGoal, selectedPeriod]
  );

  const exercisesText = (noteBody || "").trim();
  const exercisesTitle = (noteTitle || "").trim() || "Vježbe";

  const RADIUS = 54;
  const CIRC = 2 * Math.PI * RADIUS;
  const ringColor = stats.consistencyPct >= 70 ? "#22c55e" : "#f97316";
  const colCount = Math.min(stats.weekSquares.length, 13);

  return (
    <div className="profile">
      <div className="profile-header">
        <h2 className="profile-title">Moj profil</h2>
      </div>

      <div className="profile-card">
        <label className="profile-label">
          <FaUser style={{ marginRight: "8px" }} />
          Ime i prezime:
        </label>
        <div className="profile-value">{name || "-"}</div>
      </div>

      <div className="profile-card">
        <label className="profile-label">
          <FaPhone style={{ marginRight: "8px" }} />
          Broj mobitela:
        </label>
        <div className="profile-value">{phone}</div>
      </div>

      {remainingVisits !== null && (
        <div className="profile-card visits">
          <div className="visits-row-perfect">
            <span className="visits-clean-title">Preostali dolasci:</span>
            <span className="visits-clean-number">{remainingVisits}</span>
          </div>
        </div>
      )}

      <div className="profile-action-row">
        <button className="profile-action-btn" onClick={() => setShowExercisesModal(true)}>
          Vježbe
        </button>
        <button className="profile-action-btn" onClick={() => setShowStatisticsModal(true)}>
          Statistika
        </button>
        <button className="profile-action-btn" onClick={() => setShowMeasurementsModal(true)}>
          Mjerenje
        </button>
      </div>

      <div className="profile-buttons-row">
        <button className="profile-history-button" onClick={() => setShowHistoryModal(true)}>
          <FaFolderOpen style={{ marginRight: "6px" }} />
          Prošli termini
        </button>

        <button onClick={handleLogout} className="profile-logout-button">
          <FaSignOutAlt style={{ marginRight: "6px" }} />
          Odjava
        </button>
      </div>

      {showExercisesModal && (
        <div className="profile-history-overlay" onClick={() => setShowExercisesModal(false)}>
          <div className="profile-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-history-header">
              <h3>{exercisesTitle}</h3>
              <button className="profile-history-close" onClick={() => setShowExercisesModal(false)}>
                ✕
              </button>
            </div>
            <div className="profile-exercises-body" style={{ whiteSpace: "pre-line" }}>
              {exercisesText ? exercisesText : "Trenutno nema dodanih vježbi."}
            </div>
          </div>
        </div>
      )}

      {showStatisticsModal && (
        <div className="profile-history-overlay" onClick={() => setShowStatisticsModal(false)}>
          <div className="profile-history-modal stats-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-history-header">
              <h3>Statistika</h3>
              <button className="profile-history-close" onClick={() => setShowStatisticsModal(false)}>
                ✕
              </button>
            </div>

            {/* Period selector */}
            <div className="stats-period-row">
              {(["1m", "3m", "6m", "12m"] as Period[]).map((p) => (
                <button
                  key={p}
                  className={`stats-period-btn${selectedPeriod === p ? " active" : ""}`}
                  onClick={() => setSelectedPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Consistency ring */}
            <div className="stats-ring-wrapper">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle
                  cx="70" cy="70" r={RADIUS}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="12"
                />
                <circle
                  cx="70" cy="70" r={RADIUS}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(stats.consistencyPct / 100) * CIRC} ${CIRC}`}
                  transform="rotate(-90 70 70)"
                  style={{ transition: "stroke-dasharray 0.5s ease" }}
                />
                <text x="70" y="66" textAnchor="middle" fill="white" fontSize="22" fontWeight="700">
                  {stats.consistencyPct}%
                </text>
                <text x="70" y="84" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">
                  konzistentnost
                </text>
              </svg>
            </div>

            {/* Averages */}
            <div className="stats-avg-row">
              <div className="stats-avg-card">
                <span className="stats-avg-value">{stats.avgPerWeek}</span>
                <span className="stats-avg-label">prosjek / tjedan</span>
              </div>
              <div className="stats-avg-card">
                <span className="stats-avg-value">{stats.avgPerMonth}</span>
                <span className="stats-avg-label">prosjek / mj</span>
              </div>
            </div>

            {/* vs previous period */}
            <div className={`stats-trend${stats.trend > 0 ? " up" : stats.trend < 0 ? " down" : " neutral"}`}>
              {stats.trend > 0
                ? `+${stats.trend}% bolje od prošlog razdoblja`
                : stats.trend < 0
                ? `${stats.trend}% lošije od prošlog razdoblja`
                : "Jednako kao prošlo razdoblje"}
            </div>

            {/* Streak */}
            <div className="stats-streak-section">
              <div className="stats-streak-header">
                <span>Streak: <strong>{stats.currentStreak} tj</strong></span>
                <span>Rekord: <strong>{stats.recordStreak} tj</strong></span>
              </div>
              {stats.recordStreak > stats.currentStreak && stats.currentStreak > 0 && (
                <p className="stats-streak-message">
                  Samo {stats.recordStreak - stats.currentStreak}{" "}
                  {stats.recordStreak - stats.currentStreak === 1 ? "tjedan" : "tjedna"} do rekorda!
                </p>
              )}
              <div
                className="stats-squares-grid"
                style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
              >
                {stats.weekSquares.map((w, i) => (
                  <div
                    key={i}
                    className={`stats-square${w.met ? " met" : " missed"}`}
                    title={`${w.count} dolazaka`}
                  />
                ))}
              </div>
            </div>

            {/* Motivational card */}
            <div className="stats-motivation">
              <p>{getMotivationalText(stats.consistencyPct, stats.trend, name, stats.avgPerWeek, weeklyGoal, stats.currentStreak, stats.weeksMetGoal, stats.weekSquares.length)}</p>
            </div>

            {/* Weekly goal */}
            <div className="stats-goal-row">
              <span className="stats-goal-label">Tjedni cilj:</span>
              <div className="stats-goal-controls">
                <button className="stats-goal-btn" onClick={() => handleWeeklyGoalChange(-1)}>−</button>
                <span className="stats-goal-value">{weeklyGoal}×</span>
                <button className="stats-goal-btn" onClick={() => handleWeeklyGoalChange(+1)}>+</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMeasurementsModal && (
        <MeasurementsModal
          onClose={() => setShowMeasurementsModal(false)}
          measurements={measurements}
          circumferences={circumferences}
          circumferenceGoals={circumferenceGoals}
          gender={gender}
          birthYear={birthYear}
        />
      )}

      {showHistoryModal && (
        <div className="profile-history-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="profile-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-history-header">
              <h3>Prošli termini</h3>
              <button className="profile-history-close" onClick={() => setShowHistoryModal(false)}>
                ✕
              </button>
            </div>

            {history.length === 0 ? (
              <p className="profile-history-empty">Još nemate evidentirane termine.</p>
            ) : (
              <div className="profile-history-list">
                {history.map((h, idx) => (
                  <div key={`${h.sessionId}-${idx}`} className="profile-history-item">
                    <div className="history-main">
                      <span className="history-date">{h.date}</span>
                      <span className="history-time">{h.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
