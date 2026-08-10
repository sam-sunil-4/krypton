import { useState, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // We could export a function here, or use a context.
  // For simplicity, this is just the presentation component.
  
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map(toast => (
        <div key={toast.id} className={`glass-panel p-4 rounded-md shadow-lg animate-slide-up status-${toast.type === 'error' ? 'error' : toast.type === 'warning' ? 'warning' : toast.type === 'success' ? 'healthy' : 'unknown'}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
