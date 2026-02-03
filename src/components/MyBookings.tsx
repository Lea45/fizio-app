import React, { useEffect, useState } from "react";
import "../styles/my-bookings.css";

import { FaCheckCircle, FaClock, FaTimesCircle } from "react-icons/fa";
import spinner from "./spinning-dots.svg";
import ConfirmPopup from "./ConfirmPopup";

import { db } from "../firebase";
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  runTransaction,
} from "firebase/firestore";

import { sendSmsInfobip } from "../utils/infobipSms";

type Booking = {
  id: string;
  phone: string;
  userId?: string;
  sessionId: string;
  date: string;
  time: string;
  status: "rezervirano" | "cekanje";
};

type MyBookingsProps = {
  onChanged: (message: string) => void;
};

function getSessionDateTime(booking: Booking): Date | null {
  if (!booking.date || !booking.time) return null;

  const [d, m, yRaw] = booking.date.split(".");
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year = parseInt(yRaw.replace(/\D/g, ""), 10);

  const [start] = booking.time.split(/[-–]/)[0].trim().split(" - ");
  const [h, min] = start.split(":").map(Number);

  if ([day, month, year, h, min].some((n) => Number.isNaN(n))) return null;
  return new Date(year, month - 1, day, h, min, 0, 0);
}

const MyBookings = ({ }: MyBookingsProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalMessage, setInfoModalMessage] = useState<React.ReactNode>("");

  const [confirmCancelBooking, setConfirmCancelBooking] =
    useState<Booking | null>(null);

  const [isWorking, setIsWorking] = useState(false);

  const phone = localStorage.getItem("phone");
  const userId = localStorage.getItem("userId");

  const showPopup = (msg: React.ReactNode) => {
    setInfoModalMessage(msg);
    setShowInfoModal(true);
    setTimeout(() => setShowInfoModal(false), 2500);
  };


  async function promoteFromWaitlistIfSlotFree(sessionId: string) {
    try {
      // Dohvati sve s liste čekanja za ovaj termin (bez orderBy - izbjegava indeks)
      const waitingSnap = await getDocs(
        query(
          collection(db, "reservations"),
          where("sessionId", "==", sessionId),
          where("status", "==", "cekanje")
        )
      );
      if (waitingSnap.empty) return;

      // Sortiraj po createdAt u JS-u i uzmi prvog
      const sorted = waitingSnap.docs
        .map((d) => ({ doc: d, data: d.data() as any }))
        .sort((a, b) => {
          const aTime = a.data.createdAt?.toMillis?.() ?? 0;
          const bTime = b.data.createdAt?.toMillis?.() ?? 0;
          return aTime - bTime;
        });

      const nextDoc = sorted[0].doc;
      const nextData = sorted[0].data;

      // Koristi transakciju za atomsku promociju
      const promoted = await runTransaction(db, async (t) => {
        const sessionRef = doc(db, "sessions", sessionId);
        const sessionSnap = await t.get(sessionRef);
        if (!sessionSnap.exists()) return false;

        const sessionData = sessionSnap.data() as any;
        const maxSlots = Number(sessionData.maxSlots ?? 0);
        if (!maxSlots) return false;

        // Provjeri trenutni broj rezervacija (fresh read unutar transakcije)
        const reservedSnap = await getDocs(
          query(
            collection(db, "reservations"),
            where("sessionId", "==", sessionId),
            where("status", "==", "rezervirano")
          )
        );

        if (reservedSnap.size >= maxSlots) return false;

        // Provjeri da osoba još uvijek čeka
        const waitingRef = doc(db, "reservations", nextDoc.id);
        const waitingDocSnap = await t.get(waitingRef);
        if (!waitingDocSnap.exists()) return false;

        const currentData = waitingDocSnap.data() as any;
        if (currentData.status !== "cekanje") return false;

        // Prebaci na rezervaciju
        t.update(waitingRef, {
          status: "rezervirano",
          promotedAt: new Date(),
        });

        return true;
      });

      // Ako je promocija uspjela, pošalji SMS
      if (promoted && nextData.phone) {
        await sendSmsInfobip(
          nextData.phone,
          `✅ Oslobodilo se mjesto!\nPrebačeni ste u rezervaciju:\n${nextData.date}\n${nextData.time}`
        );
      }
    } catch (err) {
      console.error("❌ Promote error:", err);
    }
  }


  async function autoPromoteMeIfPossible(waitingBookings: Booking[]) {
    if (!phone) return;
    if (waitingBookings.length === 0) return;

    for (const b of waitingBookings) {
      try {
        const sessionRef = doc(db, "sessions", b.sessionId);
        const sessionSnap = await getDoc(sessionRef);
        if (!sessionSnap.exists()) continue;

        const sessionData = sessionSnap.data() as any;
        const maxSlots = Number(sessionData.maxSlots ?? 0);
        if (!maxSlots) continue;


        const reservedSnap = await getDocs(
          query(
            collection(db, "reservations"),
            where("sessionId", "==", b.sessionId),
            where("status", "==", "rezervirano")
          )
        );

        if (reservedSnap.size >= maxSlots) continue;


        const promoted = await runTransaction(db, async (t) => {
          const myResRef = doc(db, "reservations", b.id);
          const myResSnap = await t.get(myResRef); // ✅ READ

          if (!myResSnap.exists()) return false;
          const myResData = myResSnap.data() as any;

          if (myResData.status !== "cekanje") return false;
          if (String(myResData.phone ?? "") !== String(phone ?? "")) return false;


          t.update(myResRef, { status: "rezervirano", promotedAt: new Date() });
          return true;
        });

        if (promoted) {
          await sendSmsInfobip(
            b.phone,
            `✅ Oslobodilo se mjesto!\nPrebačeni ste u rezervaciju:\n${b.date}\n${b.time}`
          );

          showPopup(
            <>
              ✅ Prebačeni ste s liste čekanja u rezervaciju!
              <br />
              <br />
              {b.date}
              <br />
              {b.time}
            </>
          );


          setBookings((prev) =>
            prev.map((x) => (x.id === b.id ? { ...x, status: "rezervirano" } : x))
          );


          break;
        }
      } catch (e) {
        console.error("❌ autoPromoteMeIfPossible error:", e);
      }
    }
  }

  const fetchBookings = async () => {
    if (!phone) return;

    setLoading(true);

    const snap = await getDocs(
      query(collection(db, "reservations"), where("phone", "==", phone))
    );

    const now = new Date();

    const fetched = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) })) as Booking[];


    const future = fetched
      .filter((b) => {
        const dt = getSessionDateTime(b);
        return dt && dt.getTime() > now.getTime();
      })
      .sort((a, b) => {
        const da = getSessionDateTime(a)!;
        const dbb = getSessionDateTime(b)!;
        return da.getTime() - dbb.getTime();
      });

    setBookings(future);
    setLoading(false);


    const waitingMine = future.filter((b) => b.status === "cekanje");
    await autoPromoteMeIfPossible(waitingMine);
  };

  useEffect(() => {
    fetchBookings();

  }, []);

  const cancelBooking = async (booking: Booking) => {
    setIsWorking(true);

    try {
      const now = new Date();
      const dt = getSessionDateTime(booking);
      const diffHours = dt ? (dt.getTime() - now.getTime()) / (1000 * 60 * 60) : -999;


      const canCancel =
        !!dt &&
        dt.getTime() > now.getTime() &&
        (booking.status === "cekanje" ? true : diffHours >= 2);

      if (!canCancel) {
        showPopup("⏳ Prekasno za otkazivanje (pravilo 2 sata).");
        return;
      }

      await runTransaction(db, async (t) => {

        let userRef: any = null;
        let userSnap: any = null;

        if (userId) {
          userRef = doc(db, "users", userId);
          userSnap = await t.get(userRef);
        }


        t.delete(doc(db, "reservations", booking.id));


        if (booking.status === "rezervirano" && userId && userSnap?.exists()) {
          const data = userSnap.data();

          const past = Array.isArray(data.pastSessions) ? data.pastSessions : [];
          const filteredPast = past.filter(
            (p: any) => p.sessionId !== booking.sessionId
          );

          t.update(userRef, {
            remainingVisits: Number(data.remainingVisits ?? 0) + 1,
            pastSessions: filteredPast,
          });
        }
      });

      await promoteFromWaitlistIfSlotFree(booking.sessionId);

      setBookings((prev) => prev.filter((b) => b.id !== booking.id));

      showPopup(
        <>
          ❌ Termin otkazan
          <br />
          <br />
          {booking.date}
          <br />
          {booking.time}
        </>
      );

    } catch (err: any) {
      console.error("❌ Cancel error:", err);
      showPopup(
        <>
          ❌ Greška pri otkazivanju
          <br />
          <small>{String(err?.message ?? err)}</small>
        </>
      );
    } finally {
      setIsWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="bookings-loading">
        <img src={spinner} alt="Učitavanje..." />
      </div>
    );
  }

  return (
    <div className="my-bookings">
      {showInfoModal && (
        <ConfirmPopup
          infoOnly
          message={infoModalMessage}
          onCancel={() => setShowInfoModal(false)}
        />
      )}

      {confirmCancelBooking && (
        <ConfirmPopup
          message={
            <>
              <strong>Otkazati termin?</strong>
              <br />
              {confirmCancelBooking.date}
              <br />
              {confirmCancelBooking.time}
            </>
          }
          onConfirm={async () => {
            const b = confirmCancelBooking;
            setConfirmCancelBooking(null);
            if (b) await cancelBooking(b);
          }}
          onCancel={() => setConfirmCancelBooking(null)}
        />
      )}

      {bookings.length === 0 ? (
        <p className="no-bookings-message">Nemate aktivnih termina.</p>
      ) : (
        <div className="bookings-list">
          {bookings.map((b) => {
            const dt = getSessionDateTime(b);
            const now = new Date();
            const diffHours = dt ? (dt.getTime() - now.getTime()) / (1000 * 60 * 60) : -999;

            const canCancel =
              !!dt &&
              dt.getTime() > now.getTime() &&
              (b.status === "cekanje" ? true : diffHours >= 2);

            return (
              <div className="booking-card" key={b.id}>
                <div className="booking-info">
                  <span>{b.date}</span>
                  <span>{b.time}</span>
                </div>

                <div className="booking-status">
                  {b.status === "rezervirano" ? (
                    <span className="status-tag reserved">
                      <FaCheckCircle /> Rezervirano
                    </span>
                  ) : (
                    <span className="status-tag waiting">
                      <FaClock /> Čekanje
                    </span>
                  )}
                </div>

                <button
                  className="cancel-button booking-full"
                  disabled={!canCancel || isWorking}
                  onClick={() => canCancel && !isWorking && setConfirmCancelBooking(b)}
                  style={{
                    opacity: !canCancel || isWorking ? 0.6 : 1,
                    cursor: !canCancel || isWorking ? "not-allowed" : "pointer",
                  }}
                >
                  <FaTimesCircle />
                  {isWorking
                    ? "Radim..."
                    : canCancel
                      ? "Otkaži"
                      : "Prekasno za otkazivanje"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyBookings;
