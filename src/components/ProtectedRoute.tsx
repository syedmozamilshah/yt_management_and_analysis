import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, userStatus, isAdmin } = useAuth();

  // Show loading during initial auth check
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#cc0000]" />
      </div>
    );
  }

  // Not logged in - redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admin always has access
  if (isAdmin) {
    return <>{children}</>;
  }

  // Show loading while user status is being fetched (prevents flash of dashboard)
  if (userStatus === null) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#cc0000]" />
      </div>
    );
  }

  // Check user status - only block if explicitly pending or blocked
  if (userStatus === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (userStatus === 'blocked') {
    return <Navigate to="/blocked" replace />;
  }

  // If approved, allow access
  return <>{children}</>;
};

export default ProtectedRoute;
