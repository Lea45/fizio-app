import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

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
          const data = docSnap.data();
          setAdminCode(data.code);
        } else {
          console.error("Nema admin koda u bazi!");
          setStatus("⛔ Admin kod nije postavljen u bazi.");
        }
      } catch (error) {
        console.error("Greška kod dohvaćanja admin koda:", error);
        setStatus("⛔ Greška pri dohvaćanju admin koda.");
      }
    };

    fetchAdminCode();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminCode) {
      setStatus("⛔ Admin kod nije učitan.");
      return;
    }

    if (codeInput === adminCode) {
      setStatus("✅ Uspješna prijava.");
      localStorage.setItem("admin", "true");
      onAdminLoginSuccess();
    } else {
      setStatus("⛔ Pogrešan kod.");
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
