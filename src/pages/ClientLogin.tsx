import { useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

interface ClientLoginProps {
  onBack: () => void;
  onLoginSuccess: () => void;
}

const ClientLogin: React.FC<ClientLoginProps> = ({
  onBack,
  onLoginSuccess,
}) => {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = phone.trim();

    if (!trimmed) {
      setError("Unesi svoj kod.");
      return;
    }

    try {
      const clientsRef = collection(db, "users"); // ⬅️ promjena
      const q = query(clientsRef, where("phone", "==", trimmed));
      const snap = await getDocs(q);

      if (snap.empty) {
        setError("Nemaš pristup. Obrati se treneru/trenerici.");
        return;
      }

      const clientDoc = snap.docs[0];
      const clientData = clientDoc.data();
      console.log("Prijavljen klijent:", clientDoc.id, clientData);

      onLoginSuccess();
    } catch (err) {
      console.error(err);
      setError("Došlo je do greške. Pokušaj ponovno.");
    }
  };

  return (
    <div className="client-login-wrapper">
      <h2 className="login-title">REZERVACIJA TERMINA</h2>
      <div className="login-underline" />
      <form className="login-card" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Unesi svoj kod"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="login-input"
        />
        <button type="submit" className="login-btn-primary">
          Prijavi se
        </button>
        <button type="button" className="login-btn-secondary" onClick={onBack}>
          Natrag na početnu
        </button>
        {error && <p className="login-error">{error}</p>}
      </form>
    </div>
  );
};

export default ClientLogin;
