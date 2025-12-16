import React, { useEffect, useState } from "react";

interface StartScreenProps {
  onClientClick: () => void;
  onAdminClick: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({
  onClientClick,
  onAdminClick,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  // 🔹 presretni PWA install event
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault(); // spriječi default mini-infobar
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setCanInstall(false);
  };

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

        <button type="button" className="card-btn admin" onClick={onAdminClick}>
          ADMIN
        </button>
      </div>

      {/* 📲 INSTALL GUMB */}
      {canInstall && (
        <button
          type="button"
          className="install-btn"
          onClick={handleInstall}
        >
          📲 Dodaj aplikaciju na početni zaslon
        </button>
      )}

      {/* ℹ️ iOS hint (opcionalno) */}
      {!canInstall && /iphone|ipad|ipod/i.test(navigator.userAgent) && (
        <p className="ios-install-hint">
          📱 Na iPhoneu: Safari → Dijeli → <strong>Add to Home Screen</strong>
        </p>
      )}
    </div>
  );
};

export default StartScreen;
