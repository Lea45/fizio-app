import { useState } from "react";
import StartScreen from "./components/StartScreen";
import LoginFizio from "./components/LoginFizio";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard"; // ⬅️ NOVO umjesto ScheduleAdmin

type View =
  | "start"
  | "clientLogin"
  | "clientDashboard"
  | "adminLogin"
  | "adminDashboard";

function ClientDashboard({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="login-wrapper">
      <h2>Klijentska aplikacija</h2>
      <p>Uspješno ste prijavljeni kao klijent. 👌</p>
      <button onClick={onLogout} className="back-btn">
        Odjava
      </button>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("start");

  switch (view) {
    case "clientLogin":
      return (
        <LoginFizio
          onLoginSuccess={() => setView("clientDashboard")}
          onBackToHome={() => setView("start")}
        />
      );

    case "adminLogin":
      return (
        <AdminLogin
          onAdminLoginSuccess={() => setView("adminDashboard")}
          onBackToHome={() => setView("start")}
        />
      );

    case "clientDashboard":
      return <ClientDashboard onLogout={() => setView("start")} />;

    case "adminDashboard":
      return <AdminDashboard />; // ⬅️ SAD IDE DASHBOARD S TABOVIMA

    case "start":
    default:
      return (
        <StartScreen
          onClientClick={() => setView("clientLogin")}
          onAdminClick={() => setView("adminLogin")}
        />
      );
  }
}
