type Props = {
  onAdminClick: () => void;
  onClientClick: () => void;
};

export default function StartScreen({ onAdminClick, onClientClick }: Props) {
  return (
    <div className="start-wrap">
      <div className="start-inner">
        <div className="brand-card">
          <h1 className="brand-title">Fizikalna terapija Zoran Peršić</h1>
          <p className="brand-subtitle">
            Kineziterapijske vježbe <br /> by Marko Čakan
          </p>
        </div>

        <div className="start-grid">
          <button className="card-btn client" onClick={onClientClick}>
            KLIJENT
          </button>
          <button className="card-btn admin" onClick={onAdminClick}>
            ADMIN
          </button>
        </div>
      </div>
    </div>
  );
}
