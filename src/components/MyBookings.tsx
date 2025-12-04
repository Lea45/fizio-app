import React from "react";
import { useEffect, useState } from "react";
import "../styles/my-bookings.css";

import { FaCheckCircle, FaClock, FaTimesCircle } from "react-icons/fa";
import spinner from "./spinning-dots.svg";

import ConfirmPopup from "./ConfirmPopup";

import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  deleteDoc,
} from "firebase/firestore";

type Booking = {
  id: string;
  phone: string;
  sessionId: string;
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
  const [infoModalMessage, setInfoModalMessage] = useState<React.ReactNode>("");
  const [loading, setLoading] = useState(true);
  const [confirmCancelBooking, setConfirmCancelBooking] =
    useState<Booking | null>(null);

  const phone = localStorage.getItem("phone");

  const fetchBookings = async () => {
    if (!phone) return;

    setLoading(true);

    const q = query(
      collection(db, "reservations"),
      where("phone", "==", phone)
    );

    const snap = await getDocs(q);
    const fetched = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    })) as Booking[];

    // Sortiraj po datumu + vremenu
    fetched.sort((a, b) => {
      const [da, ma, ya] = a.date.split(".").map(Number);
      const [dbb, mb, yb] = b.date.split(".").map(Number);
      return (
        new Date(ya, ma - 1, da).getTime() -
        new Date(yb, mb - 1, dbb).getTime()
      );
    });

    setBookings(fetched);
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const cancelBooking = async (booking: Booking) => {
    try {
      await deleteDoc(doc(db, "reservations", booking.id));

      // Makni iz lokalnog state-a
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));

      // Elegantna popup poruka
      setInfoModalMessage(
        <>
          Otkazali ste termin:
          <br />
          {booking.date}
          <br />
          {booking.time}
        </>
      );
      setShowInfoModal(true);

      // NEMA više onChanged("Termin otkazan.")
    } catch (err) {
      console.error("❌ Greška pri otkazivanju:", err);
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
      {/* INFO POPUP */}
      {showInfoModal && (
        <ConfirmPopup
          infoOnly
          message={infoModalMessage}
          onCancel={() => setShowInfoModal(false)}
        />
      )}

      {/* CONFIRM CANCEL POPUP */}
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
          onConfirm={() => {
            cancelBooking(confirmCancelBooking);
            setConfirmCancelBooking(null);
          }}
          onCancel={() => setConfirmCancelBooking(null)}
        />
      )}

      {bookings.length === 0 ? (
        <p className="no-bookings-message">Nemate rezerviranih termina.</p>
      ) : (
        <div className="bookings-list">
          {bookings.map((booking) => {
            const now = new Date();
            const [d, m, y] = booking.date.split(".");
            const dateISO = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
            const startTime = booking.time.split(" - ")[0].trim();
            const [hours, minutes] = startTime.split(":").map(Number);
            const sessionDateTime = new Date(dateISO);
            sessionDateTime.setHours(hours, minutes, 0, 0);

            const isPast = sessionDateTime.getTime() < now.getTime();
            const timeDiffHours =
              (sessionDateTime.getTime() - now.getTime()) /
              (1000 * 60 * 60);

            const canCancel = !isPast && timeDiffHours >= 2;

            return (
              <div className="booking-card" key={booking.id}>
                {/* DATUM + VRIJEME */}
                <div className="booking-info">
                  <span className="booking-date">{booking.date}</span>
                  <span className="booking-time">{booking.time}</span>
                </div>

                {/* STATUS */}
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

                {/* GUMB — FULL WIDTH */}
                <button
                  className="cancel-button booking-full"
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
    </div>
  );
};

export default MyBookings;
