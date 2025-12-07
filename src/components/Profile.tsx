import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import "../styles/profile.css";
import {
  FaPhone,
  FaUser,
  FaSignOutAlt,
  FaCheckCircle,
  FaClock,
  FaFolderOpen,
} from "react-icons/fa";

type HistoryItem = {
  id: string;
  date: string;
  time: string;
  createdAt?: number; // za sortiranje, ako postoji u bazi
};

export default function Profile() {
  const storedPhone = localStorage.getItem("phone");
  const storedUserId = localStorage.getItem("userId");

  const [phone] = useState(storedPhone || "");
  const [userId] = useState(storedUserId || "");
  const [name, setName] = useState("");
  const [remainingVisits, setRemainingVisits] = useState<number | null>(null);
  const [validUntil, setValidUntil] = useState("");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // 🔹 User podaci
  useEffect(() => {
    if (!phone) return;

    const qUser = query(collection(db, "users"), where("phone", "==", phone));

    const unsubscribe = onSnapshot(qUser, (snap) => {
      if (!snap.empty) {
        const userDoc = snap.docs[0];
        const userData = userDoc.data() as any;
        setName(userData.name || "");
        setRemainingVisits(userData.remainingVisits ?? null);
        setValidUntil(userData.validUntil ?? "");
      }
    });

    return () => unsubscribe();
  }, [phone]);

  // 🔹 Povijest termina iz Firestore-a (reservations)
useEffect(() => {
  if (!userId && !phone) return;

  // 👇 privremeno logiranje da vidimo što se događa
  console.log("userId iz localStorage:", userId);
  console.log("phone iz localStorage:", phone);

  // 🔹 ZA SAD koristimo phone, jer znamo sigurno da ga imaš
  const qHistory = query(
    collection(db, "reservations"),
    where("phone", "==", phone) // <-- OVDJE PROMIJENI AKO TI SE POLJE ZOVE DRUGAČIJE
    // where("status", "==", "rezervirano")  // ovo možemo vratiti kad potvrdimo ime/status
  );

  const unsubscribe = onSnapshot(qHistory, (snap) => {
    console.log("Broj dokumenata u povijesti:", snap.size);
    snap.docs.forEach((d) => console.log("RES:", d.id, d.data()));

    const items: HistoryItem[] = snap.docs.map((docSnap) => {
      const data = docSnap.data() as any;

      const createdAtMs =
        data.createdAt && typeof data.createdAt.toMillis === "function"
          ? data.createdAt.toMillis()
          : 0;

      return {
        id: docSnap.id,
        date: data.date || data.displayDate || "",
        time: data.time || "",
        createdAt: createdAtMs,
      };
    });

    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setHistory(items);
  });

  return () => unsubscribe();
}, [userId, phone]);


  const handleLogout = () => {
    localStorage.removeItem("phone");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    window.location.reload();
  };

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}.`;
  };

  return (
    <div className="profile">
      <div className="profile-header">
        <h2 className="profile-title">Moj profil</h2>
      </div>

      {/* OSOBNI PODACI */}
      <div className="profile-card">
        <label className="profile-label">
          <FaUser style={{ marginRight: "8px" }} />
          Ime i prezime:
        </label>
        <div className="profile-value">{name || "—"}</div>
      </div>

      <div className="profile-card">
        <label className="profile-label">
          <FaPhone style={{ marginRight: "8px" }} />
          Broj mobitela:
        </label>
        <div className="profile-value">{phone}</div>
      </div>

      {/* GUMBI – povijest + odjava */}
      <div className="profile-buttons-row">
  <button
    className="profile-history-button"
    onClick={() => setShowHistoryModal(true)}
  >
    <FaFolderOpen style={{ marginRight: "6px" }} />
    Povijest termina
  </button>

  <button onClick={handleLogout} className="profile-logout-button">
    <FaSignOutAlt style={{ marginRight: "6px" }} />
    Odjava
  </button>
</div>


      {/* DOLASCI */}
      {remainingVisits !== null && (
        <div className="profile-card visits">
          <label className="profile-label">🎟 Dolasci:</label>
          <div className="visits-content">
            <div className="visits-row">
              <span className="visits-number">{remainingVisits}</span>
              <span className="visits-text">preostalih dolazaka</span>
            </div>
            {validUntil && (
              <div className="visits-valid">
                Vrijede do: <strong>{formatDate(validUntil)}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POPUP – povijest termina */}
      {showHistoryModal && (
        <div
          className="profile-history-overlay"
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            className="profile-history-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-history-header">
              <h3>Povijest termina</h3>
              <button
                className="profile-history-close"
                onClick={() => setShowHistoryModal(false)}
              >
                ✕
              </button>
            </div>

            {history.length === 0 ? (
              <p className="profile-history-empty">
                Još nemate evidentirane termine.
              </p>
            ) : (
              <div className="profile-history-list">
                {history.map((h) => (
                  <div key={h.id} className="profile-history-item">
                    <div className="history-main">
                      <span className="history-date">{h.date}</span>
                      <span className="history-time">{h.time}</span>
                    </div>
                    <div className="history-status">
                      <FaCheckCircle className="profile-status-icon" />{" "}
                      Prisustvovali
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
