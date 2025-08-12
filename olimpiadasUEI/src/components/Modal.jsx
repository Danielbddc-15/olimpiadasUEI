import React from 'react';
import '../styles/Modal.css';

const Modal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirmar", 
  cancelText = "Cancelar",
  type = "confirm" // "confirm" | "info"
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-container">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <p className="modal-message">{message}</p>
        </div>
        
        <div className="modal-footer">
          {type === "confirm" && (
            <>
              <button 
                className="modal-btn modal-btn-cancel" 
                onClick={onClose}
              >
                {cancelText}
              </button>
              <button 
                className="modal-btn modal-btn-confirm" 
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
              >
                {confirmText}
              </button>
            </>
          )}
          {type === "info" && (
            <button 
              className="modal-btn modal-btn-confirm" 
              onClick={onClose}
            >
              Entendido
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
