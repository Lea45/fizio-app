import { useState, useEffect } from "react";
import { db } from "../firebase";
import "../styles/status-management.css";
import { FaSyncAlt, FaUndoAlt } from "react-icons/fa";
import spinner from "./spinning-dots.svg";

import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  increment,
} from "firebase/firestore";

type Reservation = {
  id: string;
  phone: string;
  name?: string;
  sessionId: string;
  date: string;
  time: string;
  status: "rezervirano" | "cekanje";
  refunded: boolean;
};

type Session = {
  id: string;
  date: string;
  time: string;
};

export default function StatusManagement() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");

  // 🔁 redoslijed dana (kao u Gioii)
  const weekdayOrder = [
    "ponedjeljak",
    "utorak",
    "srijeda",
    "četvrtak",
    "petak",
    "subota",
  ];

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await fetchSessions();
      await fetchReservations();
      setLoading(false);
    };
    loadAll();
  }, []);

  const fetchSessions = async () => {
    const snap = await getDocs(collection(db, "sessions"));
    const list: Session[] = snap.docs.map((d) => ({
      id: d.id,
      date: d.data().date,
      time: d.data().time,
    }));
    setSessions(list);
  };

  const fetchReservations = async () => {
    const snap = await getDocs(collection(db, "reservations"));
    const list: Reservation[] = snap.docs.map((d) => ({
      id: d.id,
      phone: d.data().phone,
      name: d.data().name,
      sessionId: d.data().sessionId,
      date: d.data().date,
      time: d.data().time,
      status: d.data().status,
      refunded: d.data().refunded ?? false,
    }));
    setReservations(list);
  };

  const refreshData = async () => {
    setLoading(true);
    await fetchSessions();
    await fetchReservations();
    setLoading(false);
  };

  const formatWeekday = (dateString: string) => {
    if (!dateString) return "NEPOZNAT DAN";
    const parts = dateString.split(".").map((p) => p.trim());
    if (parts.length < 3) return "NEPOZNAT DAN";

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);

    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return "NEPOZNAT DAN";

    return date
      .toLocaleDateString("hr-HR", { weekday: "long" })
      .toUpperCase();
  };

  const groupedSessions = sessions.reduce(
    (acc: { [date: string]: Session[] }, session) => {
      if (!acc[session.date]) acc[session.date] = [];
      acc[session.date].push(session);
      return acc;
    },
    {}
  );

  // 🔁 globalni refund za sve s liste čekanja kojima je termin prošao
  const handleRefundConfirmed = async () => {
    try {
      const now = new Date();

      const waitlistToRefund = reservations.filter((res) => {
        if (res.status !== "cekanje" || res.refunded) return false;

        const [day, month, year] = res.date
          .split(".")
          .map((x) => parseInt(x, 10));
        const [startHour] = res.time.split(" - ");
        const [hour, minute] = startHour.split(":").map(Number);

        const resDate = new Date(year, month - 1, day, hour, minute);
        return resDate < now;
      });

      if (waitlistToRefund.length === 0) {
        setInfoMessage("ℹ️ Nema rezervacija na čekanju za povrat.");
        setShowInfoModal(true);
        return;
      }

      for (const res of waitlistToRefund) {
        // nađi user-a po broju mobitela
        const userQuery = query(
          collection(db, "users"),
          where("phone", "==", res.phone)
        );
        const userSnap = await getDocs(userQuery);

        if (userSnap.empty) {
          console.warn(`⚠️ Korisnik ${res.phone} nije pronađen u users.`);
        } else {
          const userRef = userSnap.docs[0].ref;
          await updateDoc(userRef, {
            remainingVisits: increment(1),
          });
        }

        // označi rezervaciju kao refundiranu
        const resRef = doc(db, "reservations", res.id);
        await updateDoc(resRef, { refunded: true });
      }

      setInfoMessage(
        "✔ Vraćeni su dolasci za sve korisnike s liste čekanja čiji su termini prošli."
      );
      setShowInfoModal(true);
      refreshData();
    } catch (error) {
      console.error("Greška pri globalnom povratu:", error);
      setInfoMessage("❌ Greška prilikom vraćanja dolazaka.");
      setShowInfoModal(true);
    } finally {
      setShowConfirmModal(false);
    }
  };

  return (
    <div className="status-management-container">
      <h2>STATUS TERMINA</h2>

      {/* Gumbi / spinner */}
      <div className="status-actions">
        {loading ? (
          <img
            src={spinner}
            alt="Učitavanje..."
            style={{ width: "48px", height: "48px" }}
          />
        ) : (
          <>
            <button className="refresh-btn" onClick={refreshData}>
              <FaSyncAlt style={{ marginRight: "8px" }} />
              Osvježi
            </button>
            <button
              className="refund-btn"
              onClick={() => setShowConfirmModal(true)}
            >
              <FaUndoAlt style={{ marginRight: "8px" }} />
              Vrati dolaske
            </button>
          </>
        )}
      </div>

      <div className="status-divider"></div>

      {/* Info poruka */}
      {showInfoModal && (
        <div className="modal-overlay">
          <div className="modal">
            <p style={{ whiteSpace: "pre-line" }}>{infoMessage}</p>
            <button onClick={() => setShowInfoModal(false)} className="yes">
              U redu
            </button>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal">
            <p>
              Jesi li sigurna da želiš vratiti dolaske za sve rezervacije na
              čekanju kojima je prošao termin?
            </p>
            <div>
              <button
                className="yes"
                onClick={handleRefundConfirmed}
                style={{ marginRight: "0.5rem" }}
              >
                Da
              </button>
              <button
                className="no"
                onClick={() => setShowConfirmModal(false)}
              >
                Ne
              </button>
            </div>
          </div>
        </div>

        
      )}
      

      {/* Dani u tjednu sortirani kao u Gioii */}
      {!loading &&
        weekdayOrder.map((weekday) => {
          const entry = Object.entries(groupedSessions).find(
            ([date]) => formatWeekday(date).toLowerCase() === weekday
          );
          if (!entry) return null;

          const [date, daySessions] = entry;

          return (
            <div className="date-card" key={date}>
              <div
                className="date-header"
                onClick={() =>
                  setExpandedDate(expandedDate === date ? null : date)
                }
              >
                {formatWeekday(date)}
              </div>

              {expandedDate === date && (
                <div className="session-list">
                  {(daySessions as Session[])
                    .slice()
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map((session) => {
                      const related = reservations.filter(
                        (r) =>
                          r.date === session.date && r.time === session.time
                      );

                      const reservedCount = related.filter(
                        (r) => r.status === "rezervirano"
                      ).length;

                      return (
                        <div className="session-item" key={session.id}>
                          <div
                            className="session-title"
                            onClick={() =>
                              setExpandedSessionId(
                                expandedSessionId === session.id
                                  ? null
                                  : session.id
                              )
                            }
                          >
                            {session.time} ({reservedCount}
                            {reservedCount === 1 ||
                            reservedCount === 0 ||
                            reservedCount >= 5
                              ? " rezervacija"
                              : " rezervacije"}
                            )
                          </div>

                          {expandedSessionId === session.id && (
                            <div className="reservation-box">
                              {/* Rezervirani */}
                              {related.filter(
                                (r) => r.status === "rezervirano"
                              ).length > 0 && (
                                <>
                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    ✅ Rezervirani:
                                  </div>
                                  {related
                                    .filter((r) => r.status === "rezervirano")
                                    .map((r) => (
                                      <div
                                        key={r.id}
                                        className="reservation-item"
                                      >
                                        {r.name || r.phone}
                                      </div>
                                    ))}
                                </>
                              )}

                              {/* Lista čekanja */}
                              {related.filter(
                                (r) => r.status === "cekanje"
                              ).length > 0 && (
                                <>
                                  <hr
                                    style={{
                                      margin: "10px 0",
                                      border: "none",
                                      borderTop: "1px solid rgba(148,163,184,0.4)",
                                    }}
                                  />
                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    🕐 Lista čekanja:
                                  </div>
                                  {related
                                    .filter((r) => r.status === "cekanje")
                                    .map((r) => (
                                      <div
                                        key={r.id}
                                        className="reservation-item"
                                      >
                                        {r.name || r.phone}
                                      </div>
                                    ))}
                                </>
                              )}

                              {/* Nema nikoga */}
                              {related.length === 0 && (
                                <div className="no-reservations">
                                  Nema rezervacija
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}

    </div>
    
  );

}
