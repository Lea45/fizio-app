import { useState } from "react";
import StartScreen from "./components/StartScreen";
import Login from "./components/LoginFizio";

type View = "start" | "client" | "admin";

export default function App() {
  const [view, setView] = useState<View>("start");

  if (view === "client") {
    return (
      <Login
        mode="client"
        onLoginSuccess={() => {
          // ovdje ide dalje (client dashboard)
          console.log("Klijent prijavljen");
        }}
        onBackToHome={() => setView("start")}
      />
    );
  }

  if (view === "admin") {
    return (
      <Login
        mode="admin"
        onLoginSuccess={() => {
          // ovdje ide dalje (admin dashboard)
          console.log("Admin prijavljen");
        }}
        onBackToHome={() => setView("start")}
      />
    );
  }

  // početni ekran
  return (
    <StartScreen
      onClientClick={() => setView("client")}
      onAdminClick={() => setView("admin")}
    />
  );
}
