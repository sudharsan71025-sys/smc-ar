import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

interface UploadButtonProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export const UploadButton: React.FC<UploadButtonProps> = ({ onFileSelect, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!disabled && e.dataTransfer.files?.[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="w-full flex justify-center"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,model/gltf-binary"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      <button
        onClick={handleClick}
        disabled={disabled}
        aria-label="Upload 3D Model"
        className={`w-full max-w-sm flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-base font-medium text-white transition-all duration-200 select-none ${
          isDragOver
            ? 'bg-primary-hover ring-4 ring-primary/20 scale-[1.02]'
            : 'bg-primary hover:bg-primary-hover active:bg-primary-active'
        } ${
          disabled
            ? 'opacity-60 cursor-not-allowed'
            : 'shadow-subtle hover:shadow-card active:scale-[0.99] cursor-pointer'
        }`}
      >
        <Upload className="w-5 h-5" />
        <span>Upload 3D Model</span>
      </button>
    </div>
  );
};

