
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, userStatus, isAdmin } = useAuth();

  // Show loading during initial auth check
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-[#f1f1f1]">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admin always has access - no need to check userStatus
  if (isAdmin) {
    return <>{children}</>;
  }

  // For regular users, check their status
  // Handle pending status
  if (userStatus === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }

  // Handle blocked status
  if (userStatus === 'blocked') {
    return <Navigate to="/blocked" replace />;
  }

  // If status is 'approved', show content
  if (userStatus === 'approved') {
    return <>{children}</>;
  }

  // If status is null/undefined (still loading profile), show a brief loading state
  // This ensures the session is fully ready before rendering protected content
  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="text-[#f1f1f1]">Loading...</div>
    </div>
  );
};

export default ProtectedRoute;
