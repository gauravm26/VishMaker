import React, { useState } from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string | null;
  helperText?: string;
  showPasswordToggle?: boolean;
  onPasswordToggle?: () => void;
  showPassword?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  id,
  error,
  helperText,
  showPasswordToggle = false,
  onPasswordToggle,
  showPassword = false,
  className = '',
  type,
  ...props
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
    if (onPasswordToggle) {
      onPasswordToggle();
    }
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300">
        {label}
      </label>
      <div className="mt-1 relative rounded-md shadow-sm">
        <input
          id={id}
          type={showPasswordToggle ? (isPasswordVisible ? 'text' : 'password') : type}
          className={`
            block w-full px-4 py-3 pr-10
            bg-gray-700 border-gray-600 rounded-md
            text-white placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500
            sm:text-sm
            transition-colors duration-200
            ${error ? 'border-red-500 ring-red-500' : 'border-gray-600'}
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          {...props}
        />
        {showPasswordToggle && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5">
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="text-gray-400 hover:text-white focus:outline-none"
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            >
              {/* Eye icon would go here */}
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {helperText && <p className="mt-2 text-sm text-gray-400">{helperText}</p>}
    </div>
  );
};