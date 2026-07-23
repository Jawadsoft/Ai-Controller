import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';

// Import existing components
import Dashboard from '@/components/Dashboard';
import StaffManagement from '@/components/StaffManagement';
import CrewAIAgentManagement from '@/components/CrewAIAgentManagement';

// Example App component showing how to integrate CrewAI Agent Management
const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Routes>
          {/* Main dashboard */}
          <Route path="/" element={<Dashboard />} />
          
          {/* Staff Management */}
          <Route path="/staff" element={<StaffManagement />} />
          
          {/* CrewAI Agent Management */}
          <Route path="/crewai-agents" element={<CrewAIAgentManagement />} />
          
          {/* Redirect to dashboard for unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        {/* Toast notifications */}
        <Toaster />
      </div>
    </Router>
  );
};

export default App;
