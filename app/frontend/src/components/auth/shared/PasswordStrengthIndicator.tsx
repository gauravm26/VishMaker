import React from 'react';
import { getPasswordStrength } from '../../utils/validation';

interface PasswordStrengthIndicatorProps {
  password: string;
  showLabel?: boolean;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ 
  password, 
  showLabel = true 
}) => {
  const strength = getPasswordStrength(password);
  
  if (!password) {
    return null;
  }

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'red':
        return 'bg-red-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'blue':
        return 'bg-blue-500';
      case 'green':
        return 'bg-green-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getTextColorClasses = (color: string) => {
    switch (color) {
      case 'red':
        return 'text-red-600';
      case 'yellow':
        return 'text-yellow-600';
      case 'blue':
        return 'text-blue-600';
      case 'green':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="mt-2">
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getColorClasses(strength.color)}`}
            style={{ width: `${(strength.score / 6) * 100}%` }}
          />
        </div>
        {showLabel && (
          <span className={`text-xs font-medium ${getTextColorClasses(strength.color)}`}>
            {strength.label}
          </span>
        )}
      </div>
      
      {showLabel && (
        <div className="mt-1 text-xs text-gray-500">
          <ul className="list-disc list-inside space-y-1">
            <li className={password.length >= 8 ? 'text-green-600' : 'text-gray-400'}>
              At least 8 characters
            </li>
            <li className={password.length >= 10 ? 'text-green-600' : 'text-gray-400'}>
              At least 10 characters
            </li>
            <li className={/[a-z]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
              Lowercase letter
            </li>
            <li className={/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
              Uppercase letter
            </li>
            <li className={/\d/.test(password) ? 'text-green-600' : 'text-gray-400'}>
              Number
            </li>
            <li className={/[@$!%*?&]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
              Special character (@$!%*?&)
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}; 