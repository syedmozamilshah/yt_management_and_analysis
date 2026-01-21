
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, userStatus, isAdmin } = useAuth();

  // Only show loading during initial auth check
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
  // If status is still null (not loaded yet), show content to avoid flash
  // The status check will happen in the background
  if (userStatus === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (userStatus === 'blocked') {
    return <Navigate to="/blocked" replace />;
  }

  // If status is 'approved' or null (still loading), show content
  // This prevents loading skeleton flash for approved users
  return <>{children}</>;
};

export default ProtectedRoute;
