import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-lg shadow-lg ${className}`}>
      {children}
    </div>
  );
};
