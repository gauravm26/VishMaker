import React, { useState } from 'react';
import { Card } from '../shared/Card';
import { InputField } from '../shared/InputField';
import { Button } from '../shared/Button';
import { Spinner } from '../shared/Spinner';
import { ValidationService, ValidationError } from '../../utils/validation';

interface ConfirmSignUpFormProps {
  email: string;
  onConfirm: (email: string, confirmationCode: string) => Promise<void>;
  onBack: () => void;
}

export const ConfirmSignUpForm: React.FC<ConfirmSignUpFormProps> = ({
  email,
  onConfirm,
  onBack
}) => {
  const [confirmationCode, setConfirmationCode] = useState('');
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
      const validation = ValidationService.validateConfirmSignUp({
        email,
        confirmationCode
      });

      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      await onConfirm(email, confirmationCode);
      setMessage('Account confirmed successfully! You can now sign in.');
    } catch (err: any) {
      setErrors([{
        field: 'confirmationCode',
        message: err.message || 'Failed to confirm account',
        type: 'server'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getFieldError = (field: string) => {
    return ValidationService.getFieldError(errors, field);
  };

  return (
    <Card>
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-foreground">Confirm Your Account</h2>
        <p className="mt-2 text-sm text-gray-600">
          We've sent a confirmation code to <strong>{email}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
            {message}
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

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (
            <div className="flex items-center justify-center">
              <Spinner size="sm" className="mr-2" />
              Confirming...
            </div>
          ) : (
            'Confirm Account'
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