import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // No custom props needed for now
}

export const Button: React.FC<ButtonProps> = ({ className = '', children, ...props }) => {
  return (
    <button
      className={`
        w-full flex justify-center py-3 px-4
        border border-transparent rounded-md shadow-sm
        text-sm font-medium text-white
        bg-gradient-to-r from-purple-600 to-blue-500
        hover:from-purple-700 hover:to-blue-600
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500
        transition-all duration-300 ease-in-out
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};