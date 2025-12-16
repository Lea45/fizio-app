import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/profile.css";
import { FaPhone, FaUser, FaSignOutAlt, FaFolderOpen } from "react-icons/fa";

type PastSessionItem = {
  sessionId: string;
  date: string;
  time: string;
  createdAt?: any;
};

export default function Profile() {
  const storedPhone = localStorage.getItem("phone");
  const [phone] = useState(storedPhone || "");

  const [name, setName] = useState("");
  const [remainingVisits, setRemainingVisits] = useState<number | null>(null);


  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [showExercisesModal, setShowExercisesModal] = useState(false);


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

      const past: PastSessionItem[] = Array.isArray(userData.pastSessions)
        ? userData.pastSessions
        : [];


      const toMs = (v: any) => {
        if (!v) return 0;
        if (typeof v === "number") return v;
        if (typeof v?.toMillis === "function") return v.toMillis();
        return 0;
      };

      const sorted = [...past].sort(
        (a, b) => toMs(b.createdAt) - toMs(a.createdAt)
      );
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

  const exercisesText = (noteBody || "").trim();
  const exercisesTitle = (noteTitle || "").trim() || "Vježbe";

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
        <div className="profile-value">{name || "—"}</div>
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

      { }
      <button
        className="profile-exercises-button"
        onClick={() => setShowExercisesModal(true)}
      >
        Pogledaj vježbe
      </button>

      <div className="profile-buttons-row">
        <button
          className="profile-history-button"
          onClick={() => setShowHistoryModal(true)}
        >
          <FaFolderOpen style={{ marginRight: "6px" }} />
          Prošli termini
        </button>

        <button onClick={handleLogout} className="profile-logout-button">
          <FaSignOutAlt style={{ marginRight: "6px" }} />
          Odjava
        </button>
      </div>

      { }
      {showExercisesModal && (
        <div
          className="profile-history-overlay"
          onClick={() => setShowExercisesModal(false)}
        >
          <div
            className="profile-history-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-history-header">
              <h3>{exercisesTitle}</h3>
              <button
                className="profile-history-close"
                onClick={() => setShowExercisesModal(false)}
              >
                ✕
              </button>
            </div>

            <div
              className="profile-exercises-body"
              style={{ whiteSpace: "pre-line" }}
            >
              {exercisesText ? exercisesText : "Trenutno nema dodanih vježbi."}
            </div>
          </div>
        </div>
      )}

      { }
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
              <h3>Prošli termini</h3>
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
                {history.map((h, idx) => (
                  <div
                    key={`${h.sessionId}-${idx}`}
                    className="profile-history-item"
                  >
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
