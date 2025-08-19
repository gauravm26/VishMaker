import React, { useState } from 'react';
import apiClient from '../utils/apiClient';

interface WaitlistFormProps {
  className?: string;
  buttonText?: string;
  placeholder?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const WaitlistForm: React.FC<WaitlistFormProps> = ({
  className = '',
  buttonText = 'Join Waitlist',
  placeholder = 'Enter your email',
  onSuccess,
  onError
}) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleShowForm = () => {
    setShowForm(true);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await apiClient<{ status: string; message: string }>('/waitlist/', {
        method: 'POST',
        body: { email: email.trim() }
      });

      if (response.status === 'success') {
        setMessage({ type: 'success', text: 'Successfully joined the waitlist! We\'ll be in touch soon.' });
        setEmail('');
        setShowForm(false);
        onSuccess?.();
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setMessage(null);
        }, 5000);
      } else {
        throw new Error(response.message || 'Failed to join waitlist');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to join waitlist. Please try again.';
      setMessage({ type: 'error', text: errorMessage });
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={className}>
      {!showForm ? (
        <div className="flex justify-center">
          <button
            onClick={handleShowForm}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 rounded-2xl text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-purple-500/30 transform hover:scale-105"
          >
            {buttonText}
          </button>
        </div>
      ) : (
        <div className="animate-fade-in-up">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={placeholder}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 rounded-xl bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
              required
              autoFocus
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-purple-500/30 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? 'Joining...' : 'Submit'}
            </button>
          </form>
          
          {message && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${
              message.type === 'success' 
                ? 'bg-green-500/20 border border-green-500/30 text-green-300' 
                : 'bg-red-500/20 border border-red-500/30 text-red-300'
            }`}>
              {message.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WaitlistForm; 