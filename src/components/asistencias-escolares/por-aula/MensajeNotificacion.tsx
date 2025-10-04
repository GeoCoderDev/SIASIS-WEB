import React from "react";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";

interface MensajesNotificacionProps {
  error: ErrorResponseAPIBase | null;
  successMessage: MessageProperty | null;
  onCloseError: () => void;
  onCloseSuccess: () => void;
}

const MensajesNotificacion: React.FC<MensajesNotificacionProps> = ({
  error,
  successMessage,
  onCloseError,
  onCloseSuccess,
}) => {
  if (!error && !successMessage) {
    return null;
  }

  return (
    <div className="px-4 flex-shrink-0">
      {/* Mensaje de Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 mt-4 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p>{error.message}</p>
              <button
                onClick={onCloseError}
                className="text-xs text-red-700 hover:text-red-800 underline mt-1"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje de Éxito */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 mt-4 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p>{successMessage.message}</p>
              <button
                onClick={onCloseSuccess}
                className="text-xs text-green-700 hover:text-green-800 underline mt-1"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MensajesNotificacion;
