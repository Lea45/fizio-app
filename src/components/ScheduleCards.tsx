import React, { useEffect, useState } from "react";
import { arrayUnion } from "firebase/firestore";

import AnimatedCollapse from "./AnimatedCollapse";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";

import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
import "../styles/schedule-cards.css";
import ConfirmPopup from "./ConfirmPopup";

import {
  FaClock,
  FaUserFriends,
  FaCheckCircle,
  FaCalendarAlt,
} from "react-icons/fa";
import spinner from "./spinning-dots.svg";

type Session = {
  id: string;
  date: string;
  time: string;
  bookedSlots: number;
  maxSlots: number;
};

type Reservation = {
  id: string;
  phone: string;
  userId?: string;
  name?: string;
  sessionId: string;
  status: "rezervirano" | "cekanje";
};

type Props = {
  onReservationMade: () => void;
  onShowPopup: (message: string) => void;
};

// ✅ iOS-safe helper (bez new Date("YYYY-MM-DD") stringa)
function getSessionStart(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;

  // date: "DD.MM.YYYY." ili "DD.MM.YYYY"
  const parts = dateStr.split(".");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt((parts[2] ?? "").replace(/\D/g, ""), 10);

  // time: "HH:MM - HH:MM"
  const startPart = timeStr.split("-")[0].trim();
  const [hStr, mStr] = startPart.split(":");
  const hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);

  if ([day, month, year, hour, minute].some((n) => Number.isNaN(n))) {
    return null;
  }

  // lokalno vrijeme uređaja (stabilno na iOS-u)
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export default function ScheduleCards({
  onReservationMade,
  onShowPopup,
}: Props) {
  const [confirmSession, setConfirmSession] = useState<Session | null>(null);
  const [confirmCancelSession, setConfirmCancelSession] =
    useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [label, setLabel] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalMessage, setInfoModalMessage] = useState<React.ReactNode>("");

  const [initialLoad, setInitialLoad] = useState(true);
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});

  const phone = localStorage.getItem("phone");
  const name = localStorage.getItem("userName");
  const userId = localStorage.getItem("userId");

  const fetchData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);

    const sessionsSnap = await getDocs(collection(db, "sessions"));
    const reservationsSnap = await getDocs(collection(db, "reservations"));
    const metaDoc = await getDoc(doc(db, "draftSchedule", "meta"));

    const notesSnap = await getDocs(collection(db, "sessionsNotes"));
    const notes: Record<string, string> = {};
    notesSnap.forEach((d) => {
      notes[d.id] = (d.data() as any).text;
    });
    setDailyNotes(notes);

    const fetchedSessions = sessionsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    })) as Session[];

    const fetchedReservations = reservationsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    })) as Reservation[];

    setSessions(fetchedSessions);
    setReservations(fetchedReservations);

    if (metaDoc.exists()) {
      const data = metaDoc.data() as any;
      if (data.label) setLabel(data.label);
    }

    if (showSpinner) setLoading(false);
    setInitialLoad(false);
  };

  useEffect(() => {
    fetchData(true);

    const interval = setInterval(() => {
      fetchData(false);
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  const getDayName = (dateStr: string) => {
    const [day, month, year] = dateStr.split(".");
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    const dani = [
      "NEDJELJA",
      "PONEDJELJAK",
      "UTORAK",
      "SRIJEDA",
      "ČETVRTAK",
      "PETAK",
      "SUBOTA",
    ];
    return dani[date.getDay()];
  };

  const groupByDate = () => {
    const grouped: Record<string, Session[]> = {};
    sessions.forEach((s) => {
      if (!grouped[s.date]) grouped[s.date] = [];
      grouped[s.date].push(s);
    });
    return grouped;
  };

  const groupedSessions = groupByDate();

  const sortedDates = Object.keys(groupedSessions).sort((a, b) => {
    const [d1, m1, y1] = a.split(".").map(Number);
    const [d2, m2, y2] = b.split(".").map(Number);
    return (
      new Date(y1, m1 - 1, d1).getTime() - new Date(y2, m2 - 1, d2).getTime()
    );
  });

  const toggleDate = (date: string) => {
    setExpandedDate((prev) => (prev === date ? null : date));
  };

  const getRezervacijaZaSession = (sessionId: string) =>
    reservations.filter(
      (r) => r.sessionId === sessionId && r.status === "rezervirano"
    );

  const reserve = async (session: Session) => {
    if (!phone || !name || !userId) {
      onShowPopup("📱 Prijavite se ponovno.");
      return;
    }

    // ✅ BLOKADA prošlih termina (radi i na iPhoneu)
    const startAt = getSessionStart(session.date, session.time);
    if (!startAt) {
      onShowPopup("⚠️ Ne mogu pročitati vrijeme termina.");
      return;
    }
    if (startAt.getTime() <= Date.now()) {
      onShowPopup("⏳ Termin je prošao i ne može se rezervirati.");
      return;
    }

    try {
      const result = await runTransaction(
        db,
        async (t): Promise<{ status: "rezervirano" | "cekanje" }> => {
          // ✅ READS prvo
          const userRef = doc(db, "users", userId);
          const userSnap = await t.get(userRef);
          if (!userSnap.exists()) throw new Error("Korisnik ne postoji.");
          const userData = userSnap.data() as any;

          const sessionRef = doc(db, "sessions", session.id);
          const sessionSnap = await t.get(sessionRef);
          if (!sessionSnap.exists()) throw new Error("Termin ne postoji.");
          const sessionData = sessionSnap.data() as any;

          // ❗ alreadySnap i resSnap nisu "t.get", ali ostavljam kao kod tebe
          const alreadySnap = await getDocs(
            query(
              collection(db, "reservations"),
              where("sessionId", "==", session.id),
              where("phone", "==", phone)
            )
          );
          if (!alreadySnap.empty) throw new Error("Već ste prijavljeni.");

          const resSnap = await getDocs(
            query(
              collection(db, "reservations"),
              where("sessionId", "==", session.id),
              where("status", "==", "rezervirano")
            )
          );

          const status: "rezervirano" | "cekanje" =
            resSnap.size < Number(sessionData.maxSlots ?? 0)
              ? "rezervirano"
              : "cekanje";

          // ✅ WRITES
          const newResRef = doc(collection(db, "reservations"));
          t.set(newResRef, {
            phone,
            name,
            userId,
            sessionId: session.id,
            date: session.date,
            time: session.time,
            status,
            createdAt: new Date(),
            refunded: false,
            notified: false,
          });

          if (status === "rezervirano") {
            const remaining = Number(userData.remainingVisits ?? 0);

            t.update(userRef, {
              remainingVisits: remaining - 1,
              pastSessions: arrayUnion({
                sessionId: session.id,
                date: session.date,
                time: session.time,
                createdAt: new Date(),
              }),
            });
          }

          return { status };
        }
      );

      setInfoModalMessage(
        result.status === "rezervirano" ? (
          <>
            ✅ Rezervirali ste termin:
            <br />
            {session.date}
            <br />
            {session.time}
          </>
        ) : (
          <>
            🕐 Dodani ste na listu čekanja:
            <br />
            {session.date}
            <br />
            {session.time}
          </>
        )
      );

      setShowInfoModal(true);
      onReservationMade();
      fetchData(false);
    } catch (err) {
      console.error("RESERVE ERROR:", err);
      onShowPopup(
        `⛔ ${err instanceof Error ? err.message : "Greška pri rezervaciji."}`
      );
    }
  };

  const cancel = async (session: Session) => {
    if (!phone || !userId) return;

    const existing = reservations.find(
      (r) => r.phone === phone && r.sessionId === session.id
    );
    if (!existing) return;

    try {
      await runTransaction(db, async (t) => {
        // ✅ READS prvo
        const userRef = doc(db, "users", userId);
        const userSnap = await t.get(userRef);
        if (!userSnap.exists()) throw new Error("Korisnik ne postoji.");
        const userData = userSnap.data() as any;

        // ✅ WRITES nakon readova
        t.delete(doc(db, "reservations", existing.id));

        if (existing.status === "rezervirano") {
          const remaining = Number(userData.remainingVisits ?? 0);
          const past = Array.isArray(userData.pastSessions)
            ? userData.pastSessions
            : [];

          const filtered = past.filter((p: any) => p.sessionId !== session.id);

          t.update(userRef, {
            remainingVisits: remaining + 1,
            pastSessions: filtered,
          });
        }
      });

      setInfoModalMessage(
        <>
          ❌ Otkazali ste termin:
          <br />
          {session.date}
          <br />
          {session.time}
        </>
      );
      setShowInfoModal(true);
      fetchData(false);
    } catch (err) {
      console.error("CANCEL ERROR:", err);
      onShowPopup(
        `⛔ ${err instanceof Error ? err.message : "Greška pri otkazivanju."}`
      );
    }
  };

  if (loading && initialLoad) {
    return (
      <div className="schedule-loading">
        <img src={spinner} alt="Učitavanje..." />
      </div>
    );
  }

  return (
    <div className="schedule-wrapper">
      {label && (
        <div className="schedule-label">
          <h2 className="schedule-label-title">
            <FaCalendarAlt size={18} />
            Raspored
          </h2>
          <h2 className="schedule-label-sub">{label}</h2>
        </div>
      )}

      {confirmCancelSession && (
        <ConfirmPopup
          message={
            <>
              <strong>Otkazati termin?</strong>
              <br />
              {confirmCancelSession.date}
              <br />
              {confirmCancelSession.time}
            </>
          }
          onConfirm={() => {
            cancel(confirmCancelSession);
            setConfirmCancelSession(null);
          }}
          onCancel={() => setConfirmCancelSession(null)}
        />
      )}

      {confirmSession && (
        <ConfirmPopup
          message={
            <>
              <strong>Rezervirati termin?</strong>
              <br />
              {confirmSession.date}
              <br />
              {confirmSession.time}
            </>
          }
          onConfirm={() => {
            reserve(confirmSession);
            setConfirmSession(null);
          }}
          onCancel={() => setConfirmSession(null)}
        />
      )}

      {showInfoModal && (
        <ConfirmPopup
          message={infoModalMessage}
          onCancel={() => {
            setShowInfoModal(false);
            fetchData();
          }}
          infoOnly
        />
      )}

      {sortedDates.map((date) => (
        <div
          key={date}
          className={`day-card ${expandedDate === date ? "open" : ""}`}
        >
          <button className="day-header" onClick={() => toggleDate(date)}>
            <span>{getDayName(date)}</span>
            {expandedDate === date ? (
              <FiChevronUp className="day-chevron-icon" />
            ) : (
              <FiChevronDown className="day-chevron-icon" />
            )}
          </button>

          {dailyNotes[date] && (
            <div className="daily-note-client">
              <em>{dailyNotes[date]}</em>
            </div>
          )}

          <AnimatedCollapse isOpen={expandedDate === date}>
            {[
              ...new Map(groupedSessions[date].map((s) => [s.time, s])).values(),
            ]
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((s, index) => {
                const reserved = reservations.find(
                  (r) => r.phone === phone && r.sessionId === s.id
                );
                const isFull =
                  getRezervacijaZaSession(s.id).length >= s.maxSlots;

                // ✅ iOS-safe isPast
                const startAt = getSessionStart(s.date, s.time);
                const isPast = startAt ? startAt.getTime() < Date.now() : false;

                return (
                  <div
                    key={s.id}
                    className="session-card"
                    style={{ animationDelay: `${index * 0.07}s` }}
                  >
                    <div className="session-info">
                      <span className="session-time">
                        <FaClock className="session-time-icon" />
                        <strong>{s.time}</strong>
                      </span>
                      <span className="session-spots">
                        <FaUserFriends className="session-spots-icon" />
                        {getRezervacijaZaSession(s.id).length}/{s.maxSlots}
                      </span>
                    </div>

                    {reserved ? (
                      <div
                        className={`status-tag ${
                          reserved.status === "rezervirano"
                            ? "status-rezervirano"
                            : "status-cekanje"
                        }`}
                      >
                        {reserved.status === "rezervirano" ? (
                          <>
                            <FaCheckCircle className="status-icon" />
                            Rezervirano
                          </>
                        ) : (
                          <>
                            <FaClock className="status-icon" />
                            Čekanje
                          </>
                        )}
                      </div>
                    ) : null}

                    {!reserved && (
                      <button
                        className={`reserve-button ${
                          isPast ? "reserve-button-past" : isFull ? "full" : ""
                        }`}
                        disabled={isPast}
                        onClick={() => !isPast && setConfirmSession(s)}
                      >
                        {isPast
                          ? "Termin je prošao"
                          : isFull
                          ? "Lista čekanja"
                          : "Rezerviraj"}
                      </button>
                    )}
                  </div>
                );
              })}
          </AnimatedCollapse>
        </div>
      ))}
    </div>
  );
}
