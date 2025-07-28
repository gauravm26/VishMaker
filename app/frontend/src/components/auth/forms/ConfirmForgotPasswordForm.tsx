import React, { useState } from 'react';
import { Card } from '../shared/Card';
import { InputField } from '../shared/InputField';
import { Button } from '../shared/Button';
import { Spinner } from '../shared/Spinner';
import { PasswordStrengthIndicator } from '../shared/PasswordStrengthIndicator';
import { ValidationService, ValidationError } from '../../utils/validation';

interface ConfirmForgotPasswordFormProps {
  email: string;
  onConfirm: (email: string, confirmationCode: string, newPassword: string) => Promise<void>;
  onBack: () => void;
}

export const ConfirmForgotPasswordForm: React.FC<ConfirmForgotPasswordFormProps> = ({
  email,
  onConfirm,
  onBack
}) => {
  const [confirmationCode, setConfirmationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors([]);
    setMessage(null);

    try {
      // Validate input
      const validation = ValidationService.validateConfirmForgotPassword({
        email,
        confirmationCode,
        newPassword
      });

      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      await onConfirm(email, confirmationCode, newPassword);
      setMessage('Password reset successfully! You can now sign in with your new password.');
    } catch (err: any) {
      setErrors([{
        field: 'general',
        message: err.message || 'Failed to reset password',
        type: 'server'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getFieldError = (field: string) => {
    return ValidationService.getFieldError(errors, field);
  };

  const generalError = getFieldError('general');

  return (
    <Card>
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-foreground">Reset Your Password</h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter the confirmation code sent to <strong>{email}</strong> and your new password
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
            {message}
          </div>
        )}

        {generalError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
            {generalError}
          </div>
        )}

        <InputField
          label="Confirmation Code"
          id="confirmationCode"
          type="text"
          value={confirmationCode}
          onChange={(e) => setConfirmationCode(e.target.value)}
          placeholder="Enter 6-digit code"
          maxLength={6}
          error={getFieldError('confirmationCode')}
          helperText="Enter the 6-digit code sent to your email"
          required
        />

        <InputField
          label="New Password"
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter your new password"
          error={getFieldError('newPassword')}
          helperText="Create a strong password with at least 10 characters"
          showPasswordToggle={true}
          onPasswordToggle={() => setShowPassword(!showPassword)}
          showPassword={showPassword}
          required
        />

        {newPassword && (
          <PasswordStrengthIndicator password={newPassword} />
        )}

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (
            <div className="flex items-center justify-center">
              <Spinner size="sm" className="mr-2" />
              Resetting Password...
            </div>
          ) : (
            'Reset Password'
          )}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onBack}
          className="text-primary hover:text-primary-hover hover:underline text-sm"
        >
          Back to sign in
        </button>
      </div>
    </Card>
  );
}; 