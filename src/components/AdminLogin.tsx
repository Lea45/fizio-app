import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

type AdminLoginProps = {
  onAdminLoginSuccess: () => void;
  onBackToHome: () => void;
};

export default function AdminLogin({
  onAdminLoginSuccess,
  onBackToHome,
}: AdminLoginProps) {
  const [codeInput, setCodeInput] = useState("");
  const [adminCode, setAdminCode] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const fetchAdminCode = async () => {
      try {
        const docRef = doc(db, "adminLogin", "adminCode");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          setAdminCode(data.code);
        } else {
          console.error("Nema admin lozinke u bazi!");
          setStatus("⛔ Admin lozinka nije postavljen u bazi.");
        }
      } catch (error) {
        console.error("Greška kod dohvaćanja admin lozinke:", error);
        setStatus("⛔ Greška pri dohvaćanju admin lozinke.");
      }
    };

    fetchAdminCode();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adminCode) {
      setStatus("⛔ Admin lozinka nije učitana.");
      return;
    }

    if (codeInput !== adminCode) {
      setStatus("⛔ Pogrešna lozinka.");
      return;
    }

    try {
      setStatus("⏳ Prijava...");

      // ✅ 1) PIN je točan → sad se TIHO prijavi u Firebase Auth
      // OVO su podaci admin usera kojeg si kreirala u Firebase Authentication
      await signInWithEmailAndPassword(
        auth,
        "varzic.lea@gmail.com", // <-- promijeni na svoj admin email
        "141209" // <-- promijeni na password iz Auth
      );

      // ✅ 2) (opcionalno) zadrži tvoj localStorage gate, ali sad nije sigurnost nego UI pomoć
      localStorage.setItem("admin", "true");

      setStatus("✅ Uspješna prijava.");
      onAdminLoginSuccess();
    } catch (err) {
      console.error("Admin Firebase Auth login error:", err);
      setStatus("⛔ Greška pri prijavi (Firebase Auth).");
    }
  };

  return (
    <div className="login-page admin">
      <div className="login-container">
        <h2 className="login-role-heading">ADMIN</h2>

        <form onSubmit={handleLogin} className="login-form">
          <input
            type="password"
            className="login-input"
            placeholder="Unesi lozinku"
            value={codeInput}
            onChange={(e) => {
              setCodeInput(e.target.value);
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
              status.startsWith("✅") || status.startsWith("⏳")
                ? "status-success"
                : "status-error"
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
