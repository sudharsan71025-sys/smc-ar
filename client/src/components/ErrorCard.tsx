import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorCardProps {
  message: string;
  onRetry: () => void;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({ message, onRetry }) => {
  return (
    <div className="w-full max-w-sm flex flex-col items-center p-6 bg-surface-secondary border border-border rounded-xl shadow-subtle select-none">
      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5 text-red-500" />
      </div>

      <p className="text-sm text-content text-center mb-5 font-normal leading-relaxed">
        {message}
      </p>

      <button
        onClick={onRetry}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface border border-border text-content text-sm font-medium rounded-xl hover:bg-slate-50 active:scale-[0.99] transition-all shadow-subtle"
      >
        <RotateCcw className="w-4 h-4 text-content-secondary" />
        <span>Try Again</span>
      </button>
    </div>
  );
};
