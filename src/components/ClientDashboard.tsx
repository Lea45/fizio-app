import { useState } from "react";
import Schedule from "./Schedule";
import MyBookings from "./MyBookings";
import Profile from "./Profile";
import "../styles/client-dashboard.css";
import { FaCalendarAlt, FaCheckCircle, FaUser } from "react-icons/fa";

type Tab = "raspored" | "moji-termini" | "profil";

export default function ClientDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("raspored");
  const [refreshKey, setRefreshKey] = useState(0);
  const [popupMessage, setPopupMessage] = useState("");

  const renderContent = () => {
    switch (activeTab) {
      case "raspored":
        return (
          <Schedule
            onReservationMade={() => setRefreshKey((k) => k + 1)}
            refreshKey={refreshKey}
            onShowPopup={(msg: string) => setPopupMessage(msg)}
          />
        );
      case "moji-termini":
        return (
          <MyBookings
            onChanged={(message: string) => {
              setRefreshKey((k) => k + 1);
              setPopupMessage(message);
            }}
          />
        );
      case "profil":
        return <Profile />;
      default:
        return null;
    }
  };

  return (
    <div className="fizio-client-dashboard">
      <div className="fizio-client-tabs">
        <button
          className={`tab-button ${
            activeTab === "raspored" ? "active" : ""
          }`}
          onClick={() => setActiveTab("raspored")}
        >
          <FaCalendarAlt /> Raspored
        </button>

        <button
          className={`tab-button ${
            activeTab === "moji-termini" ? "active" : ""
          }`}
          onClick={() => setActiveTab("moji-termini")}
        >
          <FaCheckCircle /> Moji termini
        </button>

        <button
          className={`tab-button ${
            activeTab === "profil" ? "active" : ""
          }`}
          onClick={() => setActiveTab("profil")}
        >
          <FaUser /> Profil
        </button>
      </div>

      <div className="fizio-client-content">
        {renderContent()}
        {popupMessage && (
          <div className="fizio-client-popup">{popupMessage}</div>
        )}
      </div>
    </div>
  );
}
