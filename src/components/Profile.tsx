import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/profile.css";
import { FaPhone, FaUser, FaSignOutAlt, FaFolderOpen } from "react-icons/fa";

type HistoryItem = {
  id: string;
  date: string;
  time: string;
  createdAt?: number;
};

export default function Profile() {
  const storedPhone = localStorage.getItem("phone");

  const [phone] = useState(storedPhone || "");

  const [name, setName] = useState("");
  const [remainingVisits, setRemainingVisits] = useState<number | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    if (!phone) return;

    const qUser = query(collection(db, "users"), where("phone", "==", phone));

    const unsubscribe = onSnapshot(qUser, (snap) => {
      if (!snap.empty) {
        const userDoc = snap.docs[0];
        const userData = userDoc.data() as any;

        setName(userData.name || "");
        setRemainingVisits(userData.remainingVisits ?? null);
      }
    });

    return () => unsubscribe();
  }, [phone]);

  useEffect(() => {
    if (!phone) return;

    const qHistory = query(
      collection(db, "reservations"),
      where("phone", "==", phone),
      where("status", "==", "rezervirano")
    );

    const unsubscribe = onSnapshot(qHistory, (snap) => {
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
  }, [phone]);

  const handleLogout = () => {
    localStorage.removeItem("phone");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    window.location.reload();
  };

  return (
    <div className="profile">
      {}
      {}
      {}
      <div className="profile-header">
        <h2 className="profile-title">Moj profil</h2>
      </div>

      {}
      {}
      {}
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

      {}
      {}
      {}
      {remainingVisits !== null && (
        <div className="profile-card visits">
          <div className="visits-row-perfect">
            <span className="visits-clean-title">Preostali dolasci:</span>
            <span className="visits-clean-number">{remainingVisits}</span>
          </div>
        </div>
      )}

      {}
      {}
      {}
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
