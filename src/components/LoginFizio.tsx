import { useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import { sendSmsInfobip } from "../utils/infobipSms";

type LoginProps = {
  onLoginSuccess: () => void;
  onBackToHome: () => void;
};

export default function Login({ onLoginSuccess, onBackToHome }: LoginProps) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("");

  // ✅ Najsigurnija normalizacija:
  // - uzmi samo znamenke
  // - +385 / 385 / 00385 -> pretvori u 0xxxxxxxxx
  const normalizePhone = (value: string) => {
    const digits = value.replace(/\D/g, ""); // samo brojevi

    if (digits.startsWith("00385")) return "0" + digits.slice(5);
    if (digits.startsWith("385")) return "0" + digits.slice(3);

    return digits;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("");

    if (!phone.trim()) {
      setStatus("⛔ Unesite broj telefona.");
      return;
    }

    const inputPhone = normalizePhone(phone);

    try {
      const q = query(collection(db, "users"));
      const snap = await getDocs(q);

      // 🔎 Debug (privremeno): vidi što app zapravo uspoređuje
      console.log("LOGIN input:", phone, "=>", inputPhone);
      console.log("USERS count:", snap.size);

      const match = snap.docs.find((d) => {
        const raw = (d.data() as any).phone || "";
        const dbPhone = normalizePhone(String(raw));
        return dbPhone === inputPhone;
      });

      if (match) {
        const userData = match.data() as any;

        localStorage.setItem("phone", inputPhone);
        localStorage.setItem("userId", match.id);
        if (userData?.name) localStorage.setItem("userName", userData.name);

        setStatus("✅ Uspješna prijava.");
        onLoginSuccess();
      } else {
        // 🔎 Debug (privremeno): ispiši prvih par brojeva iz baze
        console.log(
          "NO MATCH. First 5 DB phones:",
          snap.docs.slice(0, 5).map((d) => ({
            raw: (d.data() as any).phone,
            normalized: normalizePhone(String((d.data() as any).phone || "")),
          }))
        );

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
          <button
            type="button"
            className="login-button"
            onClick={async () => {
              try {
                await sendSmsInfobip(
                  "+385911529422",
                  "FIZIO: Lea je, jel radi??"
                );
                setStatus("✅ Test SMS poslan.");
              } catch (e) {
                console.error(e);
                setStatus("⛔ Greška pri slanju SMS-a. Pogledaj console.");
              }
            }}
          >
            TEST SMS
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
