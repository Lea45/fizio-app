import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import StartScreen from "./components/StartScreen";
import LoginFizio from "./components/LoginFizio";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import ClientDashboard from "./components/ClientDashboard";


type View =
  | "start"
  | "clientLogin"
  | "clientDashboard"
  | "adminLogin"
  | "adminDashboard";


export default function App() {
  const [view, setView] = useState<View>("start");
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let initialized = false;
    let initialVersion: number | null = null;

    const unsub = onSnapshot(doc(db, "appConfig", "version"), (snap) => {
      if (!initialized) {
        initialized = true;
        initialVersion = snap.exists() ? (snap.data().updatedAt as number) : null;
        return;
      }
      if (!snap.exists()) return;
      const v = snap.data().updatedAt as number;
      if (v !== initialVersion) {
        setUpdateAvailable(true);
      }
    });

    return () => unsub();
  }, []);

  const banner = <UpdateBanner visible={updateAvailable} />;

  switch (view) {
    case "clientLogin":
      return (<><LoginFizio onLoginSuccess={() => setView("clientDashboard")} onBackToHome={() => setView("start")} />{banner}</>);

    case "adminLogin":
      return (<><AdminLogin onAdminLoginSuccess={() => setView("adminDashboard")} onBackToHome={() => setView("start")} />{banner}</>);

    case "clientDashboard":
      return (<><ClientDashboard />{banner}</>);

    case "adminDashboard":
      return (<><AdminDashboard />{banner}</>);

    case "start":
    default:
      return (<><StartScreen onClientClick={() => setView("clientLogin")} onAdminClick={() => setView("adminLogin")} />{banner}</>);
  }
}

function UpdateBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{
      position: "fixed",
      bottom: "1.5rem",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#0ea5e9",
      color: "white",
      padding: "0.75rem 1.5rem",
      borderRadius: "999px",
      display: "flex",
      alignItems: "center",
      gap: "1rem",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      zIndex: 9999,
      fontFamily: "monospace",
      fontSize: "14px",
      whiteSpace: "nowrap",
    }}>
      Nova verzija dostupna
      <button
        onClick={() => window.location.reload()}
        style={{
          background: "white",
          color: "#0ea5e9",
          border: "none",
          borderRadius: "999px",
          padding: "0.3rem 1rem",
          fontWeight: "bold",
          cursor: "pointer",
          fontSize: "13px",
        }}
      >
        Osvježi
      </button>
    </div>
  );
}
