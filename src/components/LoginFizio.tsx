import { useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { normalizePhone } from "../utils/normalizePhone";


type LoginProps = {
  onLoginSuccess: () => void;
  onBackToHome: () => void;
};

export default function Login({ onLoginSuccess, onBackToHome }: LoginProps) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("");

    if (!phone.trim()) {
      setStatus("⛔ Unesite broj telefona.");
      return;
    }

    const inputPhone = normalizePhone(phone);

    try {
      // Brzi put: query po phoneNormalized (1 čitanje umjesto svih korisnika)
      let matchDoc: any = null;
      const fastSnap = await getDocs(
        query(collection(db, "users"), where("phoneNormalized", "==", inputPhone))
      );

      if (!fastSnap.empty) {
        matchDoc = fastSnap.docs[0];
      } else {
        // Fallback za stare korisnike bez phoneNormalized polja
        const allSnap = await getDocs(collection(db, "users"));
        matchDoc = allSnap.docs.find((d) => {
          const raw = (d.data() as any).phone || "";
          return normalizePhone(String(raw)) === inputPhone;
        }) ?? null;
      }

      if (matchDoc) {
        const userData = matchDoc.data() as any;

        localStorage.setItem("phone", inputPhone);
        localStorage.setItem("userId", matchDoc.id);
        if (userData?.name) localStorage.setItem("userName", userData.name);

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
    <div className="login-page user">
      <div className="login-container">
        <h2 className="login-role-heading">REZERVACIJA TERMINA</h2>

        <form onSubmit={handleLogin} className="login-form">
          <input
            type="tel"
            className="login-input"
            placeholder="Unesi broj mobitela"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setStatus("");
            }}
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
