import { useState } from "react";
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
      return <ClientDashboard  />;

    case "adminDashboard":
      return <AdminDashboard />;

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
