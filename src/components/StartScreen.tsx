import React from "react";

interface StartScreenProps {
  onClientClick: () => void;
  onAdminClick: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({
  onClientClick,
  onAdminClick,
}) => {
  return (
    <div className="start-wrap">
      <div className="brand-card">
        <h1 className="brand-title">Fizikalna terapija Zoran Peršić</h1>
        <p className="brand-subtitle">Kineziterapijske vježbe by Marko Čakan</p>
      </div>

      <div className="start-grid">
        <button
          type="button"
          className="card-btn client"
          onClick={onClientClick}
        >
          REZERVACIJA TERMINA
        </button>

        <button
          type="button"
          className="card-btn admin"
          onClick={onAdminClick}
        >
          ADMIN
        </button>
      </div>
    </div>
  );
};

export default StartScreen;
