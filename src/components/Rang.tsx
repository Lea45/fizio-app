import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/rang.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type PastSession = { sessionId: string; date: string; time: string; createdAt?: any };
type Measurement = { date: string; weight?: number; muscleMass?: number; fatMass?: number; vo2max?: number; biologicalAge?: number };

type UserRow = {
  id: string;
  name: string;
  pastSessions: PastSession[];
  measurements: Measurement[];
  birthYear?: number;
};

type LeaderboardEntry = { id: string; name: string; score: number; isMe: boolean };
type SubTab = "all-time" | "tjedni" | "kg-skinuto" | "nagrade";

type BadgeDef = { id: string; emoji: string; name: string; uvjet: string; poruka: string; threshold: number };

// ─── Badge Definitions ────────────────────────────────────────────────────────

const DOLASCI_BADGES: BadgeDef[] = [
  { id: "prva-stepenica", emoji: "🥉", name: "Prva stepenica", uvjet: "10 dolazaka", poruka: "Svaki put kad dođeš, pobjeđuješ. Deset puta si to učinio/la.", threshold: 10 },
  { id: "dosljednost",    emoji: "⚡", name: "Dosljednost",    uvjet: "25 dolazaka", poruka: "25 dolazaka. Navika je izgrađena — tijelo i um to već znaju.", threshold: 25 },
  { id: "posvecenost",   emoji: "🔥", name: "Posvećenost",    uvjet: "50 dolazaka", poruka: "50 puta si odabrao/la sebe umjesto izlike. To se ne može simulirati.", threshold: 50 },
  { id: "legenda-b",     emoji: "🥇", name: "Legenda",        uvjet: "100 dolazaka", poruka: "100 dolazaka. Ovo više nije navika — ovo je identitet.", threshold: 100 },
  { id: "nepokolebljiv", emoji: "💎", name: "Nepokolebljiv/a", uvjet: "200 dolazaka", poruka: "200 dolazaka. Rijetki stižu ovako daleko. Ti si dokaz da se dugoročni rad isplati.", threshold: 200 },
  { id: "prvak",         emoji: "👑", name: "Prvak",          uvjet: "365 dolazaka", poruka: "Godišnji ekvivalent dolazaka. Ovo se ne može kupiti — samo zaslužiti.", threshold: 365 },
];

const STREAK_BADGES: BadgeDef[] = [
  { id: "klica",         emoji: "🌱", name: "Klica",          uvjet: "4 uzastopna tjedna",  poruka: "Četiri tjedna bez prekida. Nešto vrijedno je počelo rasti.", threshold: 4 },
  { id: "momentum",      emoji: "🏃", name: "Momentum",       uvjet: "8 uzastopnih tjedana", poruka: "8 tjedana bez prekida. Tijelo se prilagodilo — sad je lakše doći nego ne doći.", threshold: 8 },
  { id: "neustrashiv",   emoji: "🦁", name: "Neustrašiv/a",   uvjet: "12 uzastopnih tjedana", poruka: "Tri mjeseca uzastopno. Disciplina koja ne ovisi o raspoloženju — to je prava snaga.", threshold: 12 },
  { id: "nezaustavljiv", emoji: "🚀", name: "Nezaustavljiv/a", uvjet: "20 uzastopnih tjedana", poruka: "20 tjedana zaredom. Ovo nije slučajnost — ovo je karakter. Izniman si.", threshold: 20 },
];

const TIJELO_BADGES: BadgeDef[] = [
  { id: "prva-promjena",   emoji: "⚖️",  name: "Prva promjena",    uvjet: "≥ 2 kg izgubljeno",          poruka: "Vaga to potvrđuje — 2 kg manje. Tijelo je počelo reagirati na trud.", threshold: 0 },
  { id: "snaga-raste",     emoji: "💪",  name: "Snaga raste",       uvjet: "+1 kg mišićne mase",         poruka: "Mišić ne laže. Plus jedan kilogram mišićnog tkiva — svaki trening je ostavio trag.", threshold: 0 },
  { id: "vitalni",         emoji: "❤️",  name: "Vitalni",           uvjet: "VO2max ▲ ≥ 3 ml/kg/min",    poruka: "Aerobni kapacitet raste. Srce radi učinkovitije — svaki korak, svaki dah postaje lakši.", threshold: 0 },
  { id: "podmladio",       emoji: "🕰️", name: "Podmladio/la se",   uvjet: "Biološka dob < kronološke",  poruka: "Biološki si mlađi/a nego što piše u putovnici. To nije slučajnost — to je izbor koji praviš svaki tjedan.", threshold: 0 },
  { id: "rekomponizacija", emoji: "🎯",  name: "Rekomponizacija",   uvjet: "Mišić ▲ + masna masa ▼",    poruka: "Izgubio/la si masno tkivo i dobio/la mišić — u isto vrijeme. To je napredna razina. Zasluženo.", threshold: 0 },
];

const POSEBNE_BADGES: BadgeDef[] = [
  { id: "rani-ptica", emoji: "🌅", name: "Rani ptica",   uvjet: "5 jutarnjih termina (do 9h)", poruka: "Dok drugi spavaju, ti treniraš. Pet jutarnjih treninga — disciplina koja se vidi u rezultatima.", threshold: 5 },
  { id: "comeback",   emoji: "🔄", name: "Comeback",     uvjet: "Povratak nakon 3+ tj. pauze", poruka: "Pao/la si i vratio/la se. To zahtijeva više hrabrosti od nikad ne stati. Dobrodošao/la natrag.", threshold: 0 },
  { id: "godisnjak",  emoji: "🌊", name: "Godišnjak",    uvjet: "1 godina od prvog dolaska",   poruka: "Godinu dana u programu. Prošlo si kroz dobre i loše tjedne — i ostao/la. To je prava posvećenost.", threshold: 0 },
  { id: "rekorder",   emoji: "🏆", name: "Rekorder/ka",  uvjet: "Novi rekord dolazaka / mj.",  poruka: "Novi osobni rekord — najviše dolazaka u jednom mjesecu. Ovo je tvoj novi standard.", threshold: 0 },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || "Korisnik";
  return `${parts[0]} ${parts[1][0]}.`;
}

function parseDateStr(s: string): Date | null {
  if (!s) return null;
  const parts = s.split(".");
  const dd = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  const yyyy = parseInt((parts[2] ?? "").replace(/\D/g, ""), 10);
  if (isNaN(dd) || isNaN(mm) || isNaN(yyyy) || yyyy < 2000) return null;
  return new Date(yyyy, mm - 1, dd);
}

function getMondayOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function monKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStreak(sessions: PastSession[]): number {
  const byWeek = new Map<string, number>();
  for (const s of sessions) {
    const d = parseDateStr(s.date);
    if (!d) continue;
    const key = monKey(getMondayOfWeek(d));
    byWeek.set(key, (byWeek.get(key) || 0) + 1);
  }
  const curMon = getMondayOfWeek(new Date());
  let check = (byWeek.get(monKey(curMon)) || 0) >= 1 ? new Date(curMon) : addDays(curMon, -7);
  let streak = 0;
  while ((byWeek.get(monKey(check)) || 0) >= 1) {
    streak++;
    check = addDays(check, -7);
  }
  return streak;
}

const HR_MONTHS = ["siječanj","veljača","ožujak","travanj","svibanj","lipanj","srpanj","kolovoz","rujan","listopad","studeni","prosinac"];

function getLastMonthLabel(): string {
  const today = new Date();
  const m = today.getMonth() - 1;
  const y = m < 0 ? today.getFullYear() - 1 : today.getFullYear();
  return `${HR_MONTHS[(m + 12) % 12]} ${y}.`;
}

function lastMonthCount(sessions: PastSession[]): number {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
  return sessions.filter((s) => { const d = parseDateStr(s.date); return d && d >= start && d <= end; }).length;
}

function kgLost(measurements: Measurement[]): number | null {
  const w = [...measurements]
    .filter((m) => m.weight != null)
    .sort((a, b) => (parseDateStr(a.date)?.getTime() ?? 0) - (parseDateStr(b.date)?.getTime() ?? 0));
  if (w.length < 2) return null;
  const lost = w[0].weight! - w[w.length - 1].weight!;
  return lost > 0 ? Math.round(lost * 10) / 10 : null;
}

function earnedDate(sessions: PastSession[], threshold: number): string | undefined {
  if (sessions.length < threshold) return undefined;
  const sorted = [...sessions].sort((a, b) => (parseDateStr(a.date)?.getTime() ?? 0) - (parseDateStr(b.date)?.getTime() ?? 0));
  return sorted[threshold - 1]?.date;
}

function computeBodyEarned(measurements: Measurement[], birthYear?: number): Set<string> {
  const earned = new Set<string>();
  if (measurements.length < 2) return earned;
  const sorted = [...measurements]
    .filter((m) => m.date)
    .sort((a, b) => (parseDateStr(a.date)?.getTime() ?? 0) - (parseDateStr(b.date)?.getTime() ?? 0));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  if (first.weight != null && latest.weight != null && first.weight - latest.weight >= 2)
    earned.add("prva-promjena");
  if (first.muscleMass != null && latest.muscleMass != null && latest.muscleMass - first.muscleMass >= 1)
    earned.add("snaga-raste");
  if (first.vo2max != null && latest.vo2max != null && latest.vo2max - first.vo2max >= 3)
    earned.add("vitalni");
  if (birthYear != null) {
    const chronAge = new Date().getFullYear() - birthYear;
    if (sorted.some((m) => m.biologicalAge != null && m.biologicalAge < chronAge))
      earned.add("podmladio");
  }
  if (first.muscleMass != null && latest.muscleMass != null &&
      first.fatMass != null && latest.fatMass != null &&
      latest.muscleMass > first.muscleMass && latest.fatMass < first.fatMass)
    earned.add("rekomponizacija");
  return earned;
}

function computeSpecialEarned(sessions: PastSession[]): Set<string> {
  const earned = new Set<string>();
  const morningCount = sessions.filter((s) => {
    const h = parseInt((s.time ?? "").split(/[-–]/)[0].trim().split(":")[0], 10);
    return !isNaN(h) && h < 9;
  }).length;
  if (morningCount >= 5) earned.add("rani-ptica");
  if (sessions.length > 0) {
    const sorted = [...sessions].sort((a, b) =>
      (parseDateStr(a.date)?.getTime() ?? 0) - (parseDateStr(b.date)?.getTime() ?? 0)
    );
    const firstDate = parseDateStr(sorted[0].date);
    if (firstDate) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      if (firstDate <= oneYearAgo) earned.add("godisnjak");
    }
  }
  const byMonth = new Map<string, number>();
  for (const s of sessions) {
    const d = parseDateStr(s.date);
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) || 0) + 1);
  }
  const monthsSorted = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));
  let maxSoFar = 0;
  for (const [, count] of monthsSorted) {
    if (count > maxSoFar && maxSoFar > 0) { earned.add("rekorder"); break; }
    maxSoFar = Math.max(maxSoFar, count);
  }
  const sessionDates = sessions
    .map((s) => parseDateStr(s.date))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  outer: for (let i = 1; i < sessionDates.length; i++) {
    const gapWeeks = (sessionDates[i].getTime() - sessionDates[i - 1].getTime()) / (7 * 24 * 3600 * 1000);
    if (gapWeeks >= 3) {
      const afterGap = sessionDates.slice(i);
      const weekSet = new Set(afterGap.map((d) => monKey(getMondayOfWeek(d))));
      let consecutive = 0;
      let w = new Date(getMondayOfWeek(afterGap[0]));
      for (let j = 0; j < 4; j++) {
        if (weekSet.has(monKey(w))) { consecutive++; w = addDays(w, 7); } else break;
      }
      if (consecutive >= 4) { earned.add("comeback"); break outer; }
    }
  }
  return earned;
}

// ─── Podium ───────────────────────────────────────────────────────────────────

const POS_COLOR: Record<1 | 2 | 3, string> = { 1: "#f59e0b", 2: "#94a3b8", 3: "#b45309" };
const POS_HEIGHT: Record<1 | 2 | 3, number> = { 1: 80, 2: 55, 3: 40 };
const POS_MEDAL: Record<1 | 2 | 3, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function formatScore(score: number, label: string): string {
  return label === "kg" ? `−${score} kg` : `${score} ${label}`;
}

function Podium({ entries, label }: { entries: LeaderboardEntry[]; label: string }) {
  type Slot = { entry: LeaderboardEntry; pos: 1 | 2 | 3 };
  const slots: Slot[] = [];
  if (entries[1]) slots.push({ entry: entries[1], pos: 2 });
  if (entries[0]) slots.push({ entry: entries[0], pos: 1 });
  if (entries[2]) slots.push({ entry: entries[2], pos: 3 });

  return (
    <div className="rang-podium">
      {slots.map(({ entry, pos }) => {
        const color = entry.isMe ? "#22c55e" : POS_COLOR[pos];
        return (
          <div key={entry.id} className="podium-item">
            <div
              className="podium-avatar"
              style={{ background: color, boxShadow: entry.isMe ? "0 0 0 3px #22c55e, 0 0 16px #22c55e66" : undefined }}
            >
              {getInitials(entry.name) || "?"}
              {entry.isMe && <span className="podium-ti">TI</span>}
            </div>
            <div className="podium-name">{abbreviateName(entry.name)}</div>
            <div className="podium-score">{formatScore(entry.score, label)}</div>
            <div className="podium-base" style={{ height: POS_HEIGHT[pos] }}>
              <span className="podium-medal">{POS_MEDAL[pos]}</span>
              <span className="podium-rank">{pos}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Leaderboard List ─────────────────────────────────────────────────────────

function RankRow({ entry, pos, label }: { entry: LeaderboardEntry; pos: number; label: string }) {
  return (
    <div className={`rang-row${entry.isMe ? " is-me" : ""}`}>
      <span className="rang-row-pos">{pos}.</span>
      <span className="rang-row-avatar">{getInitials(entry.name)}</span>
      <span className="rang-row-name">{abbreviateName(entry.name)}</span>
      {entry.isMe && <span className="rang-ti-tag">TI</span>}
      <span className="rang-row-score">{formatScore(entry.score, label)}</span>
    </div>
  );
}

// ─── Badge Card ───────────────────────────────────────────────────────────────

function BadgeCard({ badge, earned, date, current }: { badge: BadgeDef; earned: boolean; date?: string; current: number }) {
  return (
    <div className={`badge-card${earned ? " earned" : " locked"}`}>
      <div className="badge-emoji">{badge.emoji}</div>
      <div className="badge-name">{badge.name}</div>
      <div className="badge-uvjet">{badge.uvjet}</div>
      {earned ? (
        <>
          <p className="badge-poruka">"{badge.poruka}"</p>
          {date && <div className="badge-date">Ostvareno: {date}</div>}
        </>
      ) : (
        <div className="badge-remaining">
          {badge.threshold > 0 ? `${badge.threshold - current} do nagrade` : "Nije ostvareno"}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const SUB_LABELS: Record<SubTab, string> = {
  "all-time": "All-time",
  tjedni: "Mjesečni",
  "kg-skinuto": "Mjere",
  nagrade: "Nagrade",
};

export default function Rang() {
  const [subTab, setSubTab] = useState<SubTab>("all-time");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const myId = localStorage.getItem("userId") ?? "";

  useEffect(() => {
    getDocs(collection(db, "users")).then((snap) => {
      setUsers(snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name || "Korisnik",
          pastSessions: Array.isArray(data.pastSessions) ? data.pastSessions : [],
          measurements: Array.isArray(data.measurements) ? data.measurements : [],
          birthYear: data.birthYear ?? undefined,
        };
      }));
      setLoading(false);
    });
  }, []);

  const allTimeEntries = useMemo((): LeaderboardEntry[] =>
    users.map((u) => ({ id: u.id, name: u.name, score: u.pastSessions.length, isMe: u.id === myId }))
      .filter((e) => e.score > 0).sort((a, b) => b.score - a.score),
    [users, myId]
  );

  const tjedniEntries = useMemo((): LeaderboardEntry[] =>
    users.map((u) => ({ id: u.id, name: u.name, score: lastMonthCount(u.pastSessions), isMe: u.id === myId }))
      .filter((e) => e.score > 0).sort((a, b) => b.score - a.score),
    [users, myId]
  );

  const kgEntries = useMemo((): LeaderboardEntry[] =>
    users.flatMap((u) => {
      const lost = kgLost(u.measurements);
      return lost !== null ? [{ id: u.id, name: u.name, score: lost, isMe: u.id === myId }] : [];
    }).sort((a, b) => b.score - a.score),
    [users, myId]
  );

  const me = users.find((u) => u.id === myId);
  const totalVisits = me?.pastSessions.length ?? 0;
  const weeklyStreak = me ? computeStreak(me.pastSessions) : 0;
  const nextDolasciBadge = DOLASCI_BADGES.find((b) => b.threshold > totalVisits);
  const bodyEarned = useMemo(() => computeBodyEarned(me?.measurements ?? [], me?.birthYear), [me]);
  const specialEarned = useMemo(() => computeSpecialEarned(me?.pastSessions ?? []), [me]);
  const morningCount = useMemo(() =>
    (me?.pastSessions ?? []).filter((s) => {
      const h = parseInt((s.time ?? "").split(/[-–]/)[0].trim().split(":")[0], 10);
      return !isNaN(h) && h < 9;
    }).length,
    [me]
  );

  function renderBodySection() {
    return (
      <div className="rang-streak-section">
        <div className="rang-streak-section-title">Tjelesni napredak</div>
        {TIJELO_BADGES.map((b) => {
          const isEarned = bodyEarned.has(b.id);
          return (
            <div key={b.id} className={`rang-streak-row${isEarned ? " earned" : ""}`}>
              <span className="rang-streak-emoji">{b.emoji}</span>
              <div className="rang-streak-info">
                <div className="rang-streak-name">{b.name}</div>
                <div className="rang-streak-uvjet">{b.uvjet}</div>
                {isEarned && <p className="rang-streak-poruka">"{b.poruka}"</p>}
              </div>
              <span className="rang-streak-tag">Mjere</span>
            </div>
          );
        })}
      </div>
    );
  }

  function renderLeaderboard(entries: LeaderboardEntry[], label: string, subtitle?: string, showMotiv = true) {
    const top5 = entries.slice(0, 5);
    const myIndex = entries.findIndex((e) => e.isMe);
    const isInTop5 = myIndex >= 0 && myIndex < 5;

    // My entry: from ranked list, or placeholder with score 0 if not yet ranked
    const myEntry: LeaderboardEntry | null =
      myIndex >= 0
        ? entries[myIndex]
        : me
        ? { id: myId, name: me.name, score: 0, isMe: true }
        : null;

    const myRank = myIndex >= 0 ? myIndex + 1 : entries.length + 1;

    let motivMsg = "";
    if (myEntry && !isInTop5) {
      if (myEntry.score === 0) {
        if (label === "pos.") motivMsg = "Dođi na termin i pojavi se na rang listi!";
      } else if (myIndex > 0) {
        const above = entries[myIndex - 1];
        const diff = Math.max(1, above.score - myEntry.score);
        motivMsg = `Samo ${diff} ${label === "pos." ? "posjeta" : "kg"} do ${myIndex}. mjesta!`;
      }
    }

    return (
      <>
        {subtitle && <p className="rang-subtitle">{subtitle}</p>}
        {top5.length > 0 ? (
          <>
            <Podium entries={top5} label={label} />
            {top5.slice(3).length > 0 && (
              <div className="rang-list">
                {top5.slice(3).map((entry, idx) => (
                  <RankRow key={entry.id} entry={entry} pos={idx + 4} label={label} />
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="rang-empty">Nema podataka za {subtitle ?? "ovaj period"}.</p>
        )}
        {myEntry && !isInTop5 && (
          <>
            <div className="rang-divider" />
            <div className="rang-list">
              <RankRow entry={myEntry} pos={myRank} label={label} />
              {showMotiv && motivMsg && <p className="rang-motiv-msg">{motivMsg}</p>}
            </div>
          </>
        )}
      </>
    );
  }

  function renderNagrade() {
    return (
      <div className="nagrade-wrapper">
        <div className="next-badge-box">
          {nextDolasciBadge ? (
            <>
              <div className="next-badge-label">SLJEDEĆA NAGRADA</div>
              <div className="next-badge-title">{nextDolasciBadge.emoji} {nextDolasciBadge.name} — {nextDolasciBadge.uvjet}</div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${Math.min(100, (totalVisits / nextDolasciBadge.threshold) * 100)}%` }} />
              </div>
              <div className="progress-labels">
                <span>{totalVisits} / {nextDolasciBadge.threshold}</span>
                <span>{nextDolasciBadge.threshold - totalVisits} dolazaka do cilja</span>
              </div>
            </>
          ) : (
            <div className="next-badge-title">🏆 Sve nagrade u kategoriji dolasci su ostvarene!</div>
          )}
        </div>

        <div className="badge-section-title">Dolasci</div>
        <div className="badge-grid">
          {DOLASCI_BADGES.map((b) => (
            <BadgeCard key={b.id} badge={b} earned={totalVisits >= b.threshold}
              date={me ? earnedDate(me.pastSessions, b.threshold) : undefined}
              current={totalVisits} />
          ))}
        </div>

        <div className="badge-section-title">Tjedni streak</div>
        <div className="badge-grid">
          {STREAK_BADGES.map((b) => (
            <BadgeCard key={b.id} badge={b} earned={weeklyStreak >= b.threshold} current={weeklyStreak} />
          ))}
        </div>

        <div className="badge-section-title">Mjere</div>
        <div className="badge-grid">
          {TIJELO_BADGES.map((b) => (
            <BadgeCard key={b.id} badge={b} earned={bodyEarned.has(b.id)} current={0} />
          ))}
        </div>

        <div className="badge-section-title">Posebne</div>
        <div className="badge-grid">
          {POSEBNE_BADGES.map((b) => (
            <BadgeCard
              key={b.id}
              badge={b}
              earned={specialEarned.has(b.id)}
              current={b.id === "rani-ptica" ? morningCount : 0}
            />
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="rang-loading">Učitavanje...</div>;

  return (
    <div className="rang-wrapper">
      <div className="rang-subtabs">
        {(Object.keys(SUB_LABELS) as SubTab[]).map((t) => (
          <button key={t} className={`rang-subtab${subTab === t ? " active" : ""}`} onClick={() => setSubTab(t)}>
            {SUB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="rang-content">
        {subTab === "all-time"    && renderLeaderboard(allTimeEntries, "pos.")}
        {subTab === "tjedni" && renderLeaderboard(tjedniEntries, "pos.", getLastMonthLabel(), false)}
        {subTab === "kg-skinuto" && (
          <>
            {renderLeaderboard(kgEntries, "kg")}
            {renderBodySection()}
          </>
        )}
        {subTab === "nagrade"     && renderNagrade()}
      </div>
    </div>
  );
}
