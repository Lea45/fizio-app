import { useState } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import "../styles/login-fizio.css";

type LoginProps = {
  onLoginSuccess: () => void;
  onBackToHome: () => void;
  mode: "client" | "admin";
};

const normalizePhone = (str: string) =>
  str.replace(/\s+/g, "").replace(/^00/, "+").replace(/^\+?385/, "385");

export default function Login({ onLoginSuccess, onBackToHome, mode }: LoginProps) {
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const raw = inputValue.trim();
    if (!raw) {
      setStatus(
        mode === "admin"
          ? "⛔ Unesite lozinku."
          : "⛔ Unesite broj telefona."
      );
      return;
    }

    // ADMIN LOGIN (placeholder logika – prilagodi po potrebi)
    if (mode === "admin") {
      if (raw === "admin123") {
        setStatus("✅ Dobrodošli, admin!");
        onLoginSuccess();
      } else {
        setStatus("⛔ Pogrešna lozinka.");
      }
      return;
    }

    // CLIENT LOGIN
    const normalized = normalizePhone(raw);

    try {
      setLoading(true);
      setStatus("🔍 Provjera…");

      const q = query(
        collection(db, "users"),
        where("phone", "==", normalized),
        where("active", "==", true)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const userDoc = snap.docs[0];
        const userData = userDoc.data() as { name?: string };

        localStorage.setItem("fizio:phone", normalized);
        localStorage.setItem("fizio:userId", userDoc.id);
        localStorage.setItem("fizio:userName", userData?.name ?? "");

        setStatus("✅ Dobrodošao/la!");
        onLoginSuccess();
      } else {
        setStatus("⛔ Nemaš pristup. Obrati se treneru/trenerici.");
      }
    } catch (error) {
      console.error("Greška pri prijavi:", error);
      setStatus("⛔ Greška pri prijavi. Pokušajte ponovno.");
    } finally {
      setLoading(false);
    }
  };

return (
  <div className={`login-page ${mode}`}>
    <div className="login-role-heading">
      {mode === "admin" ? "ADMIN" : "KLIJENT"}
    </div>

    <div className="login-container">
      <input
        type={mode === "admin" ? "password" : "text"}
        placeholder={mode === "admin" ? "Unesi lozinku" : "+385..."}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !loading && handleLogin()}
        className="login-input"
      />

      <button
        onClick={handleLogin}
        className="login-button"
        disabled={loading}
      >
        {loading ? "Prijava..." : "Prijavi se"}
      </button>

      <button
        onClick={onBackToHome}
        className="login-back-button"
        disabled={loading}
      >
        Natrag na početnu
      </button>

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
  </div>
);

}
