// src/components/ScheduleCards.tsx
type ScheduleCardsProps = {
  onReservationMade: () => void;
  onShowPopup: (message: string) => void;
};

export default function ScheduleCards({
  onReservationMade,
  onShowPopup,
}: ScheduleCardsProps) {
  return (
    <div
      style={{
        padding: "2rem 1.5rem",
        borderRadius: "1rem",
        border: "1px solid rgba(148,163,184,0.4)",
        background:
          "linear-gradient(145deg, rgba(15,23,42,0.95), rgba(15,23,42,0.8))",
        color: "#e5e7eb",
        textAlign: "center",
      }}
    >
      <h2 style={{ marginBottom: "0.75rem", letterSpacing: "0.12em" }}>
        Raspored termina
      </h2>
      <p style={{ fontSize: "0.95rem", opacity: 0.9 }}>
        Ovdje će biti prikazan raspored termina za klijente (kao u Gioii).
      </p>
      <p style={{ fontSize: "0.85rem", marginTop: "0.75rem", opacity: 0.7 }}>
        Kad dodamo pravu logiku, moći ćeš rezervirati termin i vidjeti
        popunjenost.
      </p>

      <button
        onClick={() => {
          onReservationMade();
          onShowPopup("Ovo je samo demo poruka – pravi raspored još nije spojen.");
        }}
        style={{
          marginTop: "1.4rem",
          padding: "0.6rem 1.4rem",
          borderRadius: "999px",
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
          background:
            "linear-gradient(135deg, #0ea5e9, #22c55e)",
        }}
      >
        Demo gumb
      </button>
    </div>
  );
}
