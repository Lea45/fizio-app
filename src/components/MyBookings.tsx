import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import ConfirmPopup from "./ConfirmPopup";
import "../styles/my-bookings.css";
import spinner from "../assets/react.svg";
import { FaCheckCircle, FaClock, FaTimesCircle } from "react-icons/fa";

type Booking = {
  id: string;
  sessionId: string;
  phone: string;
  name?: string;
  date: string;
  time: string;
  status: "rezervirano" | "cekanje";
};

type MyBookingsProps = {
  onChanged: (message: string) => void;
};

const MyBookings = ({ onChanged }: MyBookingsProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentLabel, setCurrentLabel] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalMessage, setInfoModalMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmCancelBooking, setConfirmCancelBooking] =
    useState<Booking | null>(null);

  const phone = localStorage.getItem("phone");

  useEffect(() => {
    const fetchAll = async () => {
      if (!phone) return;
      setLoading(true);

      const snap = await getDocs(
        query(collection(db, "reservations"), where("phone", "==", phone))
      );
      const fetched = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Booking[];

      // sortiraj po datumu
      fetched.sort((a, b) => a.date.localeCompare(b.date));

      const now = new Date();

      const futureBookings = fetched.filter((b) => {
        const [d, m, y] = b.date.split(".");
        const dateISO = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        const rawTime = b.time.split(/[-–]/)[0].trim();
        const [hours, minutes] = rawTime.split(":").map(Number);
        const date = new Date(dateISO);
        date.setHours(hours, minutes, 0, 0);
        return date.getTime() >= now.getTime();
      });

      const pastBookings = fetched.filter((b) => {
        const [d, m, y] = b.date.split(".");
        const dateISO = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        const rawTime = b.time.split(/[-–]/)[0].trim();
        const [hours, minutes] = rawTime.split(":").map(Number);
        const date = new Date(dateISO);
        date.setHours(hours, minutes, 0, 0);
        return date.getTime() < now.getTime();
      });

      setBookings(futureBookings);
      localStorage.setItem("pastBookings", JSON.stringify(pastBookings));

      // meta dokument (ako ga imaš u Fizio bazi)
      const metaSnap = await getDocs(
        query(collection(db, "sessions"), where("__name__", "==", "meta"))
      );
      const metaDoc = metaSnap.docs[0];
      if (metaDoc && metaDoc.exists()) {
        const data = metaDoc.data() as any;
        if (data.label) setCurrentLabel(data.label);
      }

      setLoading(false);
    };

    fetchAll();
  }, [phone]);

  const cancelBooking = async (booking: Booking) => {
    const [d, m, y] = booking.date.split(".");
    const dateISO = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const rawTime = booking.time.split(/[-–]/)[0].trim();
    const [hours, minutes] = rawTime.split(":").map(Number);
    const sessionDateTime = new Date(dateISO);
    sessionDateTime.setHours(hours, minutes, 0, 0);

    const now = new Date();
    const timeDiffHours =
      (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const canCancel = timeDiffHours >= 2;

    try {
      await runTransaction(db, async (t) => {
        const sessionRef = doc(db, "sessions", booking.sessionId);
        const sessionSnap = await t.get(sessionRef);
        const sessionData = sessionSnap.data() as any;

        if (!sessionSnap.exists()) throw new Error("Session ne postoji.");
        if (!sessionData) throw new Error("SessionData je prazan.");

        // obriši rezervaciju
        t.delete(doc(db, "reservations", booking.id));

        let newBooked = sessionData.bookedSlots ?? 0;

        if (booking.status === "rezervirano") {
          newBooked = Math.max(0, newBooked - 1);

          // lista čekanja
          const waitSnap = await getDocs(
            query(
              collection(db, "reservations"),
              where("sessionId", "==", booking.sessionId),
              where("status", "==", "cekanje")
            )
          );

          const waitlist = waitSnap.docs
            .map((doc) => {
              const data = doc.data() as any;
              return {
                id: doc.id,
                phone: data.phone,
                createdAt: data.createdAt?.toDate?.() ?? new Date(0),
              };
            })
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

          if (waitlist.length > 0) {
            const next = waitlist[0];
            const nextRef = doc(db, "reservations", next.id);
            t.update(nextRef, { status: "rezervirano" });
            newBooked += 1;

            // ⛔ OVDJE NE ŠALJEMO WHATSAPP – samo promo
          }
        }

        t.update(sessionRef, { bookedSlots: newBooked });
      });

      // vrati dolazak ako je otkazano na vrijeme
      if (canCancel) {
        const userSnap = await getDocs(
          query(collection(db, "users"), where("phone", "==", booking.phone))
        );
        if (!userSnap.empty) {
          const userDoc = userSnap.docs[0];
          const userRef = doc(db, "users", userDoc.id);
          const current = (userDoc.data() as any).remainingVisits ?? 0;
          await updateDoc(userRef, { remainingVisits: current + 1 });
        }
      }

      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      const msg = `Otkazali ste termin:\n${booking.date}\n${booking.time}`;
      setInfoModalMessage(msg);
      setShowInfoModal(true);
      onChanged("Termin otkazan.");
    } catch (err) {
      console.error("❌ Greška pri otkazivanju:", err);
    }
  };

  return (
    <div className="my-bookings">
      {currentLabel && (
        <h3 style={{ textAlign: "center", marginBottom: "10px" }}>
          📌 Aktivni tjedan: {currentLabel}
        </h3>
      )}

      {loading ? (
        <div className="bookings-loading">
          <img src={spinner} alt="Učitavanje..." />
        </div>
      ) : bookings.length === 0 ? (
        <p className="no-bookings-message">Nemate aktivnih termina.</p>
      ) : (
        <div className="bookings-list">
          {bookings.map((booking) => {
            const now = new Date();

            const [d, m, y] = booking.date.split(".");
            const dateISO = `${y}-${m.padStart(2, "0")}-${d.padStart(
              2,
              "0"
            )}`;

            const rawTime = booking.time.split(/[-–]/)[0].trim();
            const [hours, minutes] = rawTime.split(":").map(Number);

            const bookingDateTime = new Date(dateISO);
            bookingDateTime.setHours(hours, minutes, 0, 0);

            const isToday =
              now.toDateString() === bookingDateTime.toDateString();
            const isPast = bookingDateTime.getTime() < now.getTime();

            let canCancel = true;

            if (isPast) {
              canCancel = false;
            } else if (isToday) {
              const timeDiffHours =
                (bookingDateTime.getTime() - now.getTime()) /
                (1000 * 60 * 60);
              canCancel = timeDiffHours >= 2;
            }

            return (
              <div className="booking-card" key={booking.id}>
                <div className="booking-info">
                  <span>{booking.date}</span>
                  <span>{booking.time}</span>
                </div>

                <div className="booking-status">
                  {booking.status === "rezervirano" ? (
                    <span className="status-tag reserved">
                      <FaCheckCircle className="status-icon" />
                      Rezervirano
                    </span>
                  ) : (
                    <span className="status-tag waiting">
                      <FaClock className="status-icon" />
                      Čekanje
                    </span>
                  )}
                </div>

                <button
                  className="cancel-button"
                  onClick={() =>
                    canCancel ? setConfirmCancelBooking(booking) : null
                  }
                  disabled={!canCancel}
                  style={{
                    opacity: canCancel ? 1 : 0.5,
                    cursor: canCancel ? "pointer" : "not-allowed",
                  }}
                >
                  <FaTimesCircle className="status-icon" />
                  {canCancel
                    ? "Otkaži"
                    : isPast
                    ? "Termin je prošao"
                    : "Prekasno za otkazivanje"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {confirmCancelBooking && (
        <ConfirmPopup
          message={
            <>
              Jeste li sigurni da želite otkazati termin?
              <br />
              <strong>{confirmCancelBooking.date}</strong>
              <br />
              <strong>{confirmCancelBooking.time}</strong>
            </>
          }
          onConfirm={() => {
            cancelBooking(confirmCancelBooking);
            setConfirmCancelBooking(null);
          }}
          onCancel={() => setConfirmCancelBooking(null)}
        />
      )}

      {showInfoModal && (
        <ConfirmPopup
          message={infoModalMessage}
          onCancel={() => setShowInfoModal(false)}
          infoOnly
        />
      )}
    </div>
  );
};

export default MyBookings;
