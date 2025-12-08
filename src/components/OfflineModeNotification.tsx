import React from "react";

interface OfflineModeNotificationProps {
  isVisible: boolean;
  onDismiss?: () => void;
}

export const OfflineModeNotification: React.FC<
  OfflineModeNotificationProps
> = ({ isVisible, onDismiss }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md shadow-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-5 h-5 text-blue-400">🔒</div>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-blue-800">
              Modo Offline Activado
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              La aplicación funciona sin Firebase. Los datos se almacenan
              localmente.
            </p>
            <div className="mt-2">
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-800 underline"
                onClick={() => {
                  console.log("📋 Para habilitar Firebase:");
                  console.log(
                    "1. Crea un proyecto en https://console.firebase.google.com"
                  );
                  console.log(
                    "2. Actualiza .env.local con las credenciales reales"
                  );
                  console.log("3. Reinicia el servidor de desarrollo");
                }}
              >
                ¿Cómo habilitar Firebase?
              </button>
            </div>
          </div>
          {onDismiss && (
            <div className="ml-auto">
              <button
                type="button"
                className="text-blue-400 hover:text-blue-600"
                onClick={onDismiss}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineModeNotification;
