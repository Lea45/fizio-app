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

export default function Profile() {
  const storedPhone = localStorage.getItem("phone");
  const [phone] = useState(storedPhone || "");
  const [name, setName] = useState("");
  const [remainingVisits, setRemainingVisits] = useState<number | null>(null);
  const [validUntil, setValidUntil] = useState("");

  useEffect(() => {
    if (!phone) return;

    const q = query(collection(db, "users"), where("phone", "==", phone));

    const unsubscribe = onSnapshot(q, (snap) => {
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

  const raw = localStorage.getItem("pastBookings");
  const past =
    raw &&
    (JSON.parse(raw) as { date: string; time: string; status: string }[]);

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
        <div>{name || "—"}</div>
      </div>

      <div className="profile-card">
        <label className="profile-label">
          <FaPhone style={{ marginRight: "8px" }} />
          Broj mobitela:
        </label>
        <div>{phone}</div>
      </div>

      <div className="profile-buttons-row">
        <button onClick={handleLogout} className="profile-logout-button">
          <FaSignOutAlt style={{ marginRight: "6px" }} />
          Odjava
        </button>
      </div>

      {remainingVisits !== null && (
        <div className="profile-card visits">
          <label className="profile-label">🎟 Dolasci:</label>
          <div>
            Preostalih dolazaka: {remainingVisits}
            {validUntil && (
              <div style={{ fontSize: "0.9rem", color: "#555" }}>
                Vrijede do: {formatDate(validUntil)}
              </div>
            )}
          </div>
        </div>
      )}

      {past && past.length > 0 && (
        <div className="profile-past-section">
          <h3 className="profile-past-title">
            <FaFolderOpen className="profile-status-icon2" /> Prošli termini
          </h3>
          <div className="profile-past-list">
            {past.map((b, index) => (
              <div key={index} className="profile-card">
                <div>
                  <strong>{b.date}</strong>
                </div>
                <div>{b.time}</div>
                <div className="profile-past-status">
                  {b.status === "rezervirano" ? (
                    <>
                      <FaCheckCircle className="profile-status-icon" />{" "}
                      Prisustvovali
                    </>
                  ) : (
                    <>
                      <FaClock className="profile-status-icon" /> Čekanje
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
