
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Fixed admin credentials - Admin bypasses email verification
const ADMIN_EMAIL = 'admin@videostash.com';
const ADMIN_PASSWORD = 'Admin@123456';

// Admin data mode - "my-data" views only admin's own data, "all-data" views entire database
type AdminDataMode = 'my-data' | 'all-data';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  adminDataMode: AdminDataMode;
  setAdminDataMode: (mode: AdminDataMode) => void;
  // Helper to check if we should query all data (admin + all-data mode)
  shouldQueryAllData: () => boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; isAdmin?: boolean }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Export admin email for checking
export const isAdminEmail = (email: string | undefined) => {
  return email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminDataMode, setAdminDataMode] = useState<AdminDataMode>('all-data');

  // Helper function to check if we should query all data
  const shouldQueryAllData = () => {
    return isAdmin && adminDataMode === 'all-data';
  };

  const checkAdminStatus = (userEmail: string | undefined) => {
    // Check if user is the fixed admin
    const adminStatus = isAdminEmail(userEmail);
    setIsAdmin(adminStatus);
    return adminStatus;
  };

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          checkAdminStatus(session.user.email);
        } else {
          setIsAdmin(false);
        }
        setLoading(false);
      }
    );

    // Check for existing session with timeout
    const checkSession = async () => {
      try {
        console.log('Checking for existing session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        }
        
        if (!mounted) return;
        
        console.log('Session check complete:', session?.user?.email || 'No session');
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          checkAdminStatus(session.user.email);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error in session check:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.log('Auth check timeout - setting loading to false');
        setLoading(false);
      }
    }, 5000);
    
    checkSession();

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    // Check if this is admin login
    const isAdminLogin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error && data.user) {
      const adminStatus = checkAdminStatus(data.user.email);
      return { error: null, isAdmin: adminStatus };
    }
    
    return { error, isAdmin: false };
  };

  const signUp = async (email: string, password: string) => {
    // Don't allow signup with admin email
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      return { error: { message: 'This email is reserved.' } };
    }
    
    const redirectUrl = `${window.location.origin}/home`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signOut = async () => {
    setIsAdmin(false);
    setSession(null);
    setUser(null);
    
    try {
      // Prefer local scope; some projects disallow global
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.warn('signOut(local) failed, applying client-side cleanup:', err);
      // Fallback: clear stored session locally to force logout
      try {
        // Clear all Supabase auth tokens from localStorage
        const keys = Object.keys(localStorage);
        keys.forEach((key) => {
          if (key.startsWith('sb-') && key.includes('-auth-token')) {
            localStorage.removeItem(key);
          }
        });
      } catch (storageErr) {
        console.warn('Could not clear localStorage:', storageErr);
      }
    }
    
    // Use window.location.href for navigation to ensure full page reload
    // This clears all React state and ensures clean auth state
    window.location.href = '/auth';
  };

  const value = {
    user,
    session,
    isAdmin,
    loading,
    adminDataMode,
    setAdminDataMode,
    shouldQueryAllData,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
