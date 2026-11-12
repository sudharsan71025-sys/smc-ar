import React from 'react';
import { Camera } from 'lucide-react';

interface OpenCameraButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const OpenCameraButton: React.FC<OpenCameraButtonProps> = ({ onClick, disabled }) => {
  return (
    <div className="w-full flex justify-center">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label="Open Camera"
        className={`w-full max-w-sm flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-base font-medium text-white transition-all duration-200 select-none bg-primary hover:bg-primary-hover active:bg-primary-active ${
          disabled
            ? 'opacity-60 cursor-not-allowed'
            : 'shadow-subtle hover:shadow-card active:scale-[0.99] cursor-pointer'
        }`}
      >
        <Camera className="w-5 h-5" />
        <span>Open Camera</span>
      </button>
    </div>
  );
};
