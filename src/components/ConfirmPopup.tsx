import "../styles/confirm-popup.css";

type ConfirmPopupProps = {
  message: React.ReactNode;
  onConfirm?: () => void;
  onCancel: () => void;
  infoOnly?: boolean;
};

export default function ConfirmPopup({
  message,
  onConfirm,
  onCancel,
  infoOnly,
}: ConfirmPopupProps) {
  return (
    <div className="confirm-overlay">
      <div className="confirm-modal">
        <div className="confirm-message">{message}</div>
        <div className="confirm-actions">
          {!infoOnly && (
            <button
              className="confirm-btn confirm-yes"
              onClick={onConfirm}
            >
              Da
            </button>
          )}
          <button
            className="confirm-btn confirm-no"
            onClick={onCancel}
          >
            {infoOnly ? "Zatvori" : "Ne"}
          </button>
        </div>
      </div>
    </div>
  );
}
