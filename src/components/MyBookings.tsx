import React, { useEffect, useState } from "react";
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

function getSessionDateTime(booking: Booking): Date | null {
  if (!booking.date || !booking.time) return null;

  const [dRaw, mRaw, yRawWithDot] = booking.date.split(".");
  const day = parseInt(dRaw.trim(), 10);
  const month = parseInt(mRaw.trim(), 10); // 1-12
  const year = parseInt(yRawWithDot.replace(/\D/g, "").trim(), 10);

  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
    return null;
  }

  const [startPart] = booking.time.split(" - ");
  const [hStr, mStr] = startPart.trim().split(":");
  const hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

const MyBookings = ({}: MyBookingsProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);

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

    const now = new Date();

    const futureOnly = fetched.filter((b) => {
      const dt = getSessionDateTime(b);
      if (!dt) return false;
      return dt.getTime() > now.getTime();
    });

    futureOnly.sort((a, b) => {
      const da = getSessionDateTime(a);
      const dbb = getSessionDateTime(b);
      if (!da || !dbb) return 0;
      return da.getTime() - dbb.getTime();
    });

    setBookings(futureOnly);
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const cancelBooking = async (booking: Booking) => {
    try {
      await deleteDoc(doc(db, "reservations", booking.id));

      setBookings((prev) => prev.filter((b) => b.id !== booking.id));

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
      {}
      {showInfoModal && (
        <ConfirmPopup
          infoOnly
          message={infoModalMessage}
          onCancel={() => setShowInfoModal(false)}
        />
      )}

      {}
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
            const sessionDateTime = getSessionDateTime(booking);

            let isPast = false;
            let timeDiffHours = 0;

            if (sessionDateTime) {
              isPast = sessionDateTime.getTime() < now.getTime();
              timeDiffHours =
                (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
            }

            const canCancel = !isPast && timeDiffHours >= 2;

            return (
              <div className="booking-card" key={booking.id}>
                {}
                <div className="booking-info">
                  <span className="booking-date">{booking.date}</span>
                  <span className="booking-time">{booking.time}</span>
                </div>

                {}
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

                {}
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
                  {canCancel ? "Otkaži" : "Prekasno za otkazivanje"}
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
