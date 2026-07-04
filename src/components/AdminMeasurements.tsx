import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import type { MeasurementEntry, CircumferenceEntry, CircumferenceGoals } from "./MeasurementsModal";
import "../styles/admin-measurements.css";

type Props = {
  userId: string;
  userName: string;
  onClose: () => void;
};

type InternalTab = "composition" | "circumferences";

const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

const EMPTY_M: Omit<MeasurementEntry, "date"> = {
  weight: undefined, muscleMass: undefined, fatMass: undefined,
  bmr: undefined, vo2max: undefined, biologicalAge: undefined,
};

const EMPTY_C: Omit<CircumferenceEntry, "date"> = {
  chest: undefined, waist: undefined, hips: undefined,
  bicep: undefined, thigh: undefined,
};

export default function AdminMeasurements({ userId, userName, onClose }: Props) {
  const [tab, setTab] = useState<InternalTab>("composition");

  // Podaci iz Firestore
  const [measurements, setMeasurements] = useState<MeasurementEntry[]>([]);
  const [circumferences, setCircumferences] = useState<CircumferenceEntry[]>([]);
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");

  // Formi za novi unos
  const [mDate, setMDate] = useState(today());
  const [mForm, setMForm] = useState<Omit<MeasurementEntry, "date">>(EMPTY_M);

  const [cDate, setCDate] = useState(today());
  const [cForm, setCForm] = useState<Omit<CircumferenceEntry, "date">>(EMPTY_C);
  const [goalsForm, setGoalsForm] = useState<CircumferenceGoals>({});

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const snap = await getDoc(doc(db, "users", userId));
    if (!snap.exists()) return;
    const d = snap.data();
    setMeasurements(d.measurements ?? []);
    setCircumferences(d.circumferences ?? []);
    setGoalsForm(d.circumferenceGoals ?? {});
    setGender(d.gender ?? "");
    setBirthYear(d.birthYear ? String(d.birthYear) : "");
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  // ── Spol / dob ──
  async function saveProfile() {
    setSaving(true);
    await updateDoc(doc(db, "users", userId), {
      gender,
      birthYear: birthYear ? parseInt(birthYear) : null,
    });
    setSaving(false);
    showToast("Profil spremljen.");
  }

  // ── Tjelesni sastav ──
  async function addMeasurement() {
    if (!mDate.trim()) return;
    const entry: MeasurementEntry = { date: mDate.trim(), ...stripUndefined(mForm) };
    setSaving(true);
    await updateDoc(doc(db, "users", userId), { measurements: arrayUnion(entry) });
    setMeasurements(prev => [...prev, entry]);
    setMForm(EMPTY_M);
    setMDate(today());
    setSaving(false);
    showToast("Mjerenje dodano.");
  }

  async function deleteMeasurement(idx: number) {
    const updated = measurements.filter((_, i) => i !== idx);
    setSaving(true);
    await updateDoc(doc(db, "users", userId), { measurements: updated });
    setMeasurements(updated);
    setSaving(false);
    showToast("Mjerenje obrisano.");
  }

  // ── Opsezi ──
  async function addCircumference() {
    if (!cDate.trim()) return;
    const entry: CircumferenceEntry = { date: cDate.trim(), ...stripUndefined(cForm) };
    setSaving(true);
    await updateDoc(doc(db, "users", userId), { circumferences: arrayUnion(entry) });
    setCircumferences(prev => [...prev, entry]);
    setCForm(EMPTY_C);
    setCDate(today());
    setSaving(false);
    showToast("Opsezi dodani.");
  }

  async function deleteCircumference(idx: number) {
    const updated = circumferences.filter((_, i) => i !== idx);
    setSaving(true);
    await updateDoc(doc(db, "users", userId), { circumferences: updated });
    setCircumferences(updated);
    setSaving(false);
    showToast("Opsezi obrisani.");
  }

  async function saveGoals() {
    setSaving(true);
    await updateDoc(doc(db, "users", userId), { circumferenceGoals: goalsForm });
    setSaving(false);
    showToast("Ciljevi spremljeni.");
  }

  // ── helpers ──
  function numField(
    label: string,
    unit: string,
    value: number | undefined,
    onChange: (v: number | undefined) => void
  ) {
    return (
      <div className="am-field">
        <label className="am-label">{label} <span className="am-unit">({unit})</span></label>
        <input
          type="number"
          className="am-input"
          placeholder="-"
          value={value ?? ""}
          onChange={e => onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
        />
      </div>
    );
  }

  const sortedM = [...measurements].sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date));
  const sortedC = [...circumferences].sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date));

  return (
    <div className="am-overlay" onClick={onClose}>
      <div className="am-modal" onClick={e => e.stopPropagation()}>

        <div className="am-header">
          <h3>Mjerenja — {userName}</h3>
          <button className="am-close" onClick={onClose}>✕</button>
        </div>

        {/* Spol i dob */}
        <div className="am-profile-row">
          <div className="am-field">
            <label className="am-label">Spol</label>
            <div className="am-gender-btns">
              <button className={`am-gender-btn${gender === "F" ? " active" : ""}`} onClick={() => setGender("F")}>Ž</button>
              <button className={`am-gender-btn${gender === "M" ? " active" : ""}`} onClick={() => setGender("M")}>M</button>
            </div>
          </div>
          <div className="am-field">
            <label className="am-label">Godina rođenja</label>
            <input
              type="number"
              className="am-input"
              placeholder="npr. 1995"
              value={birthYear}
              onChange={e => setBirthYear(e.target.value)}
            />
          </div>
          <button className="am-save-btn" onClick={saveProfile} disabled={saving}>Spremi</button>
        </div>

        {/* Interni tabovi */}
        <div className="am-tabs">
          <button className={`am-tab${tab === "composition" ? " active" : ""}`} onClick={() => setTab("composition")}>Tjelesni sastav</button>
          <button className={`am-tab${tab === "circumferences" ? " active" : ""}`} onClick={() => setTab("circumferences")}>Opsezi</button>
        </div>

        {/* ── TJELESNI SASTAV ── */}
        {tab === "composition" && (
          <div className="am-content">
            <p className="am-section-title">Novi unos</p>
            <div className="am-date-row">
              <label className="am-label">Datum</label>
              <input type="text" className="am-input" placeholder="DD.MM.GGGG" value={mDate} onChange={e => setMDate(e.target.value)} />
            </div>
            <div className="am-grid">
              {numField("Težina", "kg", mForm.weight, v => setMForm(p => ({ ...p, weight: v })))}
              {numField("Mišićna masa", "kg", mForm.muscleMass, v => setMForm(p => ({ ...p, muscleMass: v })))}
              {numField("Masna masa", "%", mForm.fatMass, v => setMForm(p => ({ ...p, fatMass: v })))}
              {numField("BMR", "kcal", mForm.bmr, v => setMForm(p => ({ ...p, bmr: v })))}
              {numField("VO2max", "ml/kg/min", mForm.vo2max, v => setMForm(p => ({ ...p, vo2max: v })))}
              {numField("Biološka dob", "god", mForm.biologicalAge, v => setMForm(p => ({ ...p, biologicalAge: v })))}
            </div>
            <button className="am-add-btn" onClick={addMeasurement} disabled={saving}>+ Dodaj mjerenje</button>

            {sortedM.length > 0 && (
              <>
                <div className="am-divider" />
                <p className="am-section-title">Prethodna mjerenja</p>
                <div className="am-list">
                  {sortedM.map((m, i) => (
                    <div key={i} className="am-list-item">
                      <div className="am-list-date">{m.date}</div>
                      <div className="am-list-values">
                        {m.weight != null && <span>{m.weight} kg</span>}
                        {m.muscleMass != null && <span>Miš: {m.muscleMass} kg</span>}
                        {m.fatMass != null && <span>Mas: {m.fatMass}%</span>}
                        {m.bmr != null && <span>BMR: {m.bmr}</span>}
                        {m.vo2max != null && <span>VO2: {m.vo2max}</span>}
                        {m.biologicalAge != null && <span>Bio: {m.biologicalAge} god</span>}
                      </div>
                      <button className="am-delete-btn" onClick={() => deleteMeasurement(measurements.indexOf(m))}>✕</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── OPSEZI ── */}
        {tab === "circumferences" && (
          <div className="am-content">
            <p className="am-section-title">Novi unos</p>
            <div className="am-date-row">
              <label className="am-label">Datum</label>
              <input type="text" className="am-input" placeholder="DD.MM.GGGG" value={cDate} onChange={e => setCDate(e.target.value)} />
            </div>
            <div className="am-grid">
              {numField("Prsa", "cm", cForm.chest, v => setCForm(p => ({ ...p, chest: v })))}
              {numField("Struk", "cm", cForm.waist, v => setCForm(p => ({ ...p, waist: v })))}
              {numField("Kukovi", "cm", cForm.hips, v => setCForm(p => ({ ...p, hips: v })))}
              {numField("Nadlaktica", "cm", cForm.bicep, v => setCForm(p => ({ ...p, bicep: v })))}
              {numField("Natkoljenica", "cm", cForm.thigh, v => setCForm(p => ({ ...p, thigh: v })))}
            </div>
            <button className="am-add-btn" onClick={addCircumference} disabled={saving}>+ Dodaj opsege</button>

            <div className="am-divider" />
            <div className="am-goals-wrap">
              <p className="am-section-title" style={{ marginBottom: 10 }}>Ciljevi (cm)</p>
              <div className="am-grid">
                {(["chest", "waist", "hips", "bicep", "thigh"] as const).map(k => {
                  const labels: Record<string, string> = { chest: "Prsa", waist: "Struk", hips: "Kukovi", bicep: "Nadlaktica", thigh: "Natkoljenica" };
                  return (
                    <div className="am-field" key={k}>
                      <label className="am-label">{labels[k]}</label>
                      <input
                        type="number"
                        className="am-input"
                        placeholder="cilj"
                        value={goalsForm[k] ?? ""}
                        onChange={e => setGoalsForm(p => ({ ...p, [k]: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                      />
                    </div>
                  );
                })}
              </div>
              <button className="am-save-btn" onClick={saveGoals} disabled={saving} style={{ marginTop: 10 }}>Spremi ciljeve</button>
            </div>

            {sortedC.length > 0 && (
              <>
                <div className="am-divider" />
                <p className="am-section-title">Prethodni opsezi</p>
                <div className="am-list">
                  {sortedC.map((c, i) => (
                    <div key={i} className="am-list-item">
                      <div className="am-list-date">{c.date}</div>
                      <div className="am-list-values">
                        {c.chest != null && <span>Prsa: {c.chest}</span>}
                        {c.waist != null && <span>Struk: {c.waist}</span>}
                        {c.hips != null && <span>Kukovi: {c.hips}</span>}
                        {c.bicep != null && <span>Nadl: {c.bicep}</span>}
                        {c.thigh != null && <span>Natk: {c.thigh}</span>}
                      </div>
                      <button className="am-delete-btn" onClick={() => deleteCircumference(circumferences.indexOf(c))}>✕</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {toast && <div className="am-toast">{toast}</div>}
      </div>
    </div>
  );
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function parseDateMs(s: string): number {
  if (!s) return 0;
  const parts = s.trim().split(".");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts.map(p => parseInt(p.trim(), 10));
    if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy) && yyyy > 1900) {
      return new Date(yyyy, mm - 1, dd).getTime();
    }
  }
  const fallback = new Date(s).getTime();
  return isNaN(fallback) ? 0 : fallback;
}
