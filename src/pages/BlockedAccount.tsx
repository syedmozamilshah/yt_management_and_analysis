
import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Ban, LogOut, Mail, Loader2 } from 'lucide-react';

const BlockedAccount = () => {
  const { signOut, user, userStatus, loading, isAdmin } = useAuth();
  const adminEmail = 'tuberisers@gmail.com';

  // Show loading while checking auth or userStatus is not yet determined
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
  // This prevents showing wrong page before status is loaded
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

  // If user is pending, redirect to pending page
  if (userStatus === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#181818] rounded-2xl border border-[#272727] p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-[#3d1a1a] flex items-center justify-center mx-auto mb-6">
          <Ban className="w-10 h-10 text-[#ef4444]" />
        </div>
        
        <h1 className="text-2xl font-bold text-[#f1f1f1] mb-3">
          Account Blocked
        </h1>
        
        <p className="text-[#aaaaaa] mb-6">
          Your account has been blocked. If you believe this is a mistake, please contact the administrator.
        </p>
        
        <div className="bg-[#272727] rounded-xl p-4 mb-6">
          <p className="text-sm text-[#888888] mb-1">Your account</p>
          <p className="text-[#f1f1f1] font-medium">{user?.email}</p>
        </div>
        
        <a
          href={`mailto:${adminEmail}?subject=Account%20Unblock%20Request&body=Hi%20Admin,%0A%0AI%20would%20like%20to%20request%20unblocking%20my%20account:%20${user?.email}%0A%0AThank%20you.`}
          className="flex items-center justify-center gap-2 w-full bg-[#cc0000] hover:bg-[#aa0000] text-white py-3 px-4 rounded-lg mb-3 transition-colors"
        >
          <Mail className="w-4 h-4" />
          Contact Admin: {adminEmail}
        </a>
        
        <Button
          onClick={signOut}
          variant="ghost"
          className="w-full text-[#aaaaaa] hover:text-[#f1f1f1] hover:bg-[#272727]"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default BlockedAccount;
