import { useState } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

type LoginFizioProps = {
  onLoginSuccess: () => void;
  onBackToHome: () => void;
};

export default function LoginFizio({
  onLoginSuccess,
  onBackToHome,
}: LoginFizioProps) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("");

    if (!phone.trim()) {
      setStatus("⛔ Unesite broj telefona.");
      return;
    }

    try {
      const q = query(
        collection(db, "users"),
        where("phone", "==", phone.trim()),
        where("active", "==", true)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const userDoc = snap.docs[0];
        const userData = userDoc.data();

        localStorage.setItem("phone", phone.trim());
        localStorage.setItem("userId", userDoc.id);
        if (userData.name) {
          localStorage.setItem("userName", userData.name as string);
        }

        setStatus("✅ Uspješna prijava.");
        onLoginSuccess();
      } else {
        setStatus("⛔ Nemaš pristup.");
      }
    } catch (error) {
      console.error("Greška pri prijavi:", error);
      setStatus("⛔ Greška pri prijavi. Pokušaj ponovno.");
    }
  };

  return (
    <div className="login-page client">
      <div className="login-container">
        <h2 className="login-role-heading">KLIJENT</h2>

        <form onSubmit={handleLogin} className="login-form">
          <input
            type="tel"
            className="login-input"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setStatus("");
            }}
            placeholder="Unesi broj telefona (385...)"
          />
          <button type="submit" className="login-button">
            Prijava
          </button>
        </form>

        {status && (
          <p
            className={
              status.startsWith("✅") ? "status-success" : "status-error"
            }
          >
            {status}
          </p>
        )}
      </div>
      <button onClick={onBackToHome} className="back-btn">
        ← Nazad
      </button>
    </div>
  );
}
