
import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';

const PendingApproval = () => {
  const { checkUserStatus, user, userStatus, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Auto-check status every 5 seconds
  useEffect(() => {
    if (!user || isAdmin) return;
    
    const checkStatus = async () => {
      const status = await checkUserStatus();
      if (status === 'approved') {
        navigate('/');
      } else if (status === 'blocked') {
        navigate('/blocked');
      }
    };

    // Check immediately
    checkStatus();

    // Then check every 3 seconds for faster response
    const interval = setInterval(checkStatus, 3000);

    return () => clearInterval(interval);
  }, [checkUserStatus, navigate, user, isAdmin]);

  // Also check when userStatus changes
  useEffect(() => {
    if (userStatus === 'approved') {
      navigate('/');
    } else if (userStatus === 'blocked') {
      navigate('/blocked');
    }
  }, [userStatus, navigate]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#aaaaaa]" />
      </div>
    );
  }

  // If not logged in, redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If admin, redirect to admin dashboard
  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // If userStatus is still null (loading), show spinner
  if (userStatus === null) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#aaaaaa]" />
      </div>
    );
  }

  // If user is approved, redirect to home
  if (userStatus === 'approved') {
    return <Navigate to="/" replace />;
  }

  // If user is blocked, redirect to blocked page
  if (userStatus === 'blocked') {
    return <Navigate to="/blocked" replace />;
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#181818] rounded-2xl border border-[#272727] p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-[#1a3d1a] flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-[#4ade80]" />
        </div>
        
        <h1 className="text-2xl font-bold text-[#f1f1f1] mb-3">
          Account Created!
        </h1>
        
        <p className="text-[#aaaaaa] mb-6">
          Your request is pending approval. Please check back within 24 hours. An administrator will review your request shortly.
        </p>
        
        <div className="bg-[#272727] rounded-xl p-4 mb-6">
          <p className="text-sm text-[#888888] mb-1">Signed in as</p>
          <p className="text-[#f1f1f1] font-medium">{user?.email}</p>
        </div>
        
        <div className="flex items-center justify-center gap-2 text-[#888888]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Waiting for admin approval...</span>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
