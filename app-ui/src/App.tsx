// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ProjectDashboard from './pages/ProjectDashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen w-full overflow-x-hidden">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<ProjectDashboard />} />
        </Routes>
      </div>  
    </Router>
  );
}

export default App;
