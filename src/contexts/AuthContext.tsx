
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Fixed admin credentials - Admin bypasses email verification
const ADMIN_EMAIL = 'admin@blowmeai.com';
const ADMIN_PASSWORD = 'Admin@123456';

// Admin data mode - "my-data" views only admin's own data, "all-data" views entire database
type AdminDataMode = 'my-data' | 'all-data';

// User status types
type UserStatus = 'pending' | 'approved' | 'blocked';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  userStatus: UserStatus | null;
  adminDataMode: AdminDataMode;
  setAdminDataMode: (mode: AdminDataMode) => void;
  // Helper to check if we should query all data (admin + all-data mode)
  shouldQueryAllData: () => boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; isAdmin?: boolean }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  checkUserStatus: () => Promise<UserStatus | null>;
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
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
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

  // Check user status from profiles table
  const checkUserStatus = useCallback(async (): Promise<UserStatus | null> => {
    if (!user?.id) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_status')
        .eq('id', user.id)
        .single();
      
      console.log('checkUserStatus result:', { data, error });
      
      if (error) {
        console.error('Error checking user status:', error);
        // If profile doesn't exist or RLS error, treat as pending
        setUserStatus('pending');
        return 'pending';
      }
      
      // Default to 'pending' if user_status is null
      const status = (data?.user_status as UserStatus) || 'pending';
      console.log('User status updated to:', status);
      setUserStatus(status);
      
      return status;
    } catch (error) {
      console.error('Error in checkUserStatus:', error);
      // Default to pending for safety
      setUserStatus('pending');
      return 'pending';
    }
  }, [user?.id]);

  // Poll for status changes (detect when admin blocks a user)
  useEffect(() => {
    if (!user?.id || isAdmin) return;
    
    // Check status every 10 seconds to quickly detect blocked status
    const interval = setInterval(() => {
      checkUserStatus();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [user?.id, isAdmin, checkUserStatus]);

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
          const adminStatus = checkAdminStatus(session.user.email);
          
          // Check user status from profiles (skip for admin)
          if (!adminStatus) {
            try {
              const { data, error } = await supabase
                .from('profiles')
                .select('user_status')
                .eq('id', session.user.id)
                .maybeSingle();
              
              console.log('Profile check in auth state change:', { data, error });
              
              if (error) {
                console.error('Profile error:', error);
                setUserStatus('pending');
              } else if (data) {
                const status = (data.user_status as UserStatus) || 'pending';
                console.log('Setting user status to:', status);
                setUserStatus(status);
              } else {
                console.log('No profile found, setting to pending');
                setUserStatus('pending');
              }
            } catch (e) {
              console.error('Profile check failed:', e);
              setUserStatus('pending');
            }
          } else {
            setUserStatus('approved');
          }
        } else {
          setIsAdmin(false);
          setUserStatus(null);
        }
        setLoading(false);
      }
    );

    // Check for existing session
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
          const adminStatus = checkAdminStatus(session.user.email);
          
          // Check user status from profiles (skip for admin)
          if (!adminStatus) {
            try {
              const { data, error } = await supabase
                .from('profiles')
                .select('user_status')
                .eq('id', session.user.id)
                .maybeSingle();
              
              console.log('Profile check in session check:', { data, error });
              
              if (error) {
                console.error('Profile error:', error);
                setUserStatus('pending');
              } else if (data) {
                const status = (data.user_status as UserStatus) || 'pending';
                console.log('Setting user status to:', status);
                setUserStatus(status);
              } else {
                console.log('No profile found, setting to pending');
                setUserStatus('pending');
              }
            } catch (e) {
              console.error('Profile check failed:', e);
              setUserStatus('pending');
            }
          } else {
            setUserStatus('approved');
          }
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
    console.log('signIn called with:', { email, isAdminLogin, ADMIN_EMAIL });
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    console.log('signInWithPassword result:', { data: data?.user?.email, error });
    
    if (!error && data.user) {
      const adminStatus = checkAdminStatus(data.user.email);
      console.log('Admin status check:', { userEmail: data.user.email, adminStatus });
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
    userStatus,
    adminDataMode,
    setAdminDataMode,
    shouldQueryAllData,
    signIn,
    signUp,
    signOut,
    checkUserStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
