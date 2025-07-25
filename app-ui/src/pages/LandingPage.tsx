import React, { useState } from 'react';

const LandingPage: React.FC = () => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app this would submit to an API
    console.log('Join waitlist:', email);
    setEmail('');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-white dark:bg-gray-900">
      <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">VishMaker</h1>
      <div className="w-full max-w-3xl aspect-video bg-gray-300 dark:bg-gray-700 flex items-center justify-center mb-6">
        <span className="text-gray-600 dark:text-gray-300">Video Placeholder</span>
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Enter your email"
          className="border rounded p-2 text-gray-900"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
          Join Waitlist
        </button>
      </form>
    </div>
  );
};

export default LandingPage;
