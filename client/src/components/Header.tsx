import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="flex flex-col items-center text-center mb-10 select-none">
      <h1 className="text-3xl font-bold tracking-tight text-content sm:text-4xl mb-2">
        SMC - AR
      </h1>
      <p className="text-sm sm:text-base text-content-secondary max-w-xs sm:max-w-md">
        Bring Your 3D Models Into Reality.
      </p>
    </header>
  );
};

