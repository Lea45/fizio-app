import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import ScheduleAdmin from "./ScheduleAdmin";
import StatusManagement from "./StatusManagement";
import UserManagement from "./UserManagement";
import "../styles/admin-dashboard.css";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"calendar" | "status" | "users">(
    "calendar"
  );
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "sent">("idle");

  const handleLogout = () => {
    localStorage.removeItem("admin");
    window.location.reload();
  };

  const handleNotifyUpdate = async () => {
    try {
      await setDoc(doc(db, "appConfig", "version"), { updatedAt: Date.now() });
      setNotifyStatus("sent");
      setTimeout(() => setNotifyStatus("idle"), 3000);
    } catch (err) {
      console.error("handleNotifyUpdate error:", err);
      alert("Greška: " + (err as Error).message);
    }
  };

  return (
    <div className="admin-dashboard">
      {/* TABOVI NA VRHU */}
      <div className="tab-buttons">
        <button
          className={`tab-button ${activeTab === "calendar" ? "active" : ""}`}
          onClick={() => setActiveTab("calendar")}
        >
          Termini
        </button>

        <button
          className={`tab-button ${activeTab === "status" ? "active" : ""}`}
          onClick={() => setActiveTab("status")}
        >
          Status
        </button>

        <button
          className={`tab-button ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          Korisnici
        </button>
      </div>

      {/* SADRŽAJ */}
      <div className="tab-content">
        {activeTab === "calendar" && <ScheduleAdmin />}
        {activeTab === "status" && <StatusManagement />}
        {activeTab === "users" && <UserManagement />}
      </div>

      {/* OBJAVI AŽURIRANJE */}
      <button
        onClick={handleNotifyUpdate}
        className="logout-button"
        style={{ background: notifyStatus === "sent" ? "#16a34a" : "#0ea5e9", marginBottom: "0.5rem" }}
      >
        {notifyStatus === "sent" ? "✓ Obavijest poslana" : "Objavi ažuriranje korisnicima"}
      </button>

      {/* ODJAVA */}
      <button onClick={handleLogout} className="logout-button">
        Odjavi se
      </button>
    </div>
  );
}
