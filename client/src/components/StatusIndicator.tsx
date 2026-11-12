import React from 'react';

interface StatusIndicatorProps {
  status: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  return (
    <div className="w-full max-w-sm flex flex-col items-center justify-center py-6 px-6 bg-surface-secondary border border-border rounded-xl shadow-subtle select-none">
      {/* Clean minimal spinner */}
      <div className="relative w-8 h-8 mb-3">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin" />
      </div>

      {/* Status Text */}
      <span className="text-sm font-medium text-content tracking-normal">
        {status}
      </span>
    </div>
  );
};

