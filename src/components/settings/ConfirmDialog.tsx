import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="modal-box">
        <div className="modal-header">
          <div className={`modal-icon-wrap ${confirmVariant === 'danger' ? 'icon-danger' : 'icon-primary'}`}>
            <AlertTriangle size={20} />
          </div>
          <h3 id="dialog-title" className="modal-title">
            {title}
          </h3>
        </div>

        <p className="modal-body">{message}</p>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            title="Cancel action and close dialog"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            title={`Confirm: ${confirmLabel}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
