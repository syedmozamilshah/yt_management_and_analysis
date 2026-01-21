
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Fixed admin credentials - Admin bypasses email verification
const ADMIN_EMAIL = 'admin@blowmeai.com';

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

  const shouldQueryAllData = () => isAdmin && adminDataMode === 'all-data';

  const checkAdminStatus = (userEmail: string | undefined) => {
    const adminStatus = isAdminEmail(userEmail);
    setIsAdmin(adminStatus);
    return adminStatus;
  };

  // Simple profile status check with timeout
  const fetchUserStatusWithTimeout = async (userId: string, timeoutMs: number = 3000): Promise<UserStatus> => {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.log('Profile fetch timed out, defaulting to approved');
        resolve('approved');
      }, timeoutMs);

      (supabase as any)
        .from('profiles')
        .select('user_status')
        .eq('id', userId)
        .maybeSingle()
        .then(({ data, error }: { data: any; error: any }) => {
          clearTimeout(timeoutId);
          
          if (error) {
            console.error('Profile query error:', error);
            resolve('approved'); // Default to approved on error
            return;
          }
          
          if (!data) {
            console.log('No profile found, defaulting to approved');
            resolve('approved');
            return;
          }
          
          const status = (data.user_status as UserStatus) || 'approved';
          console.log('Profile status fetched:', status);
          resolve(status);
        })
        .catch((e: any) => {
          clearTimeout(timeoutId);
          console.error('Profile fetch failed:', e);
          resolve('approved');
        });
    });
  };

  // Check user status - exposed for manual checks
  const checkUserStatus = useCallback(async (): Promise<UserStatus | null> => {
    if (!user?.id) return null;
    
    const status = await fetchUserStatusWithTimeout(user.id);
    setUserStatus(status);
    return status;
  }, [user?.id]);

  // Poll for status changes (detect when admin blocks a user)
  useEffect(() => {
    if (!user?.id || isAdmin) return;
    
    const interval = setInterval(() => {
      checkUserStatus();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [user?.id, isAdmin, checkUserStatus]);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    // Set a hard timeout - ALWAYS stop loading after 3 seconds
    timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.log('Hard timeout reached - forcing loading to complete');
        setLoading(false);
        // If we have a user set but no status, default to approved
        if (user && !userStatus && !isAdmin) {
          setUserStatus('approved');
        }
      }
    }, 3000);

    const initAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          if (mounted) setLoading(false);
          return;
        }

        if (!mounted) return;

        console.log('Session:', session?.user?.email || 'No session');
        
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const adminStatus = checkAdminStatus(session.user.email);
          
          if (adminStatus) {
            // Admin is always approved
            setUserStatus('approved');
          } else {
            // For regular users, fetch status with timeout
            const status = await fetchUserStatusWithTimeout(session.user.id, 2000);
            if (mounted) setUserStatus(status);
          }
        }

        if (mounted) setLoading(false);
      } catch (e) {
        console.error('Auth init error:', e);
        if (mounted) setLoading(false);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state changed:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const adminStatus = checkAdminStatus(session.user.email);
          
          if (adminStatus) {
            setUserStatus('approved');
          } else {
            // Fetch status with timeout
            const status = await fetchUserStatusWithTimeout(session.user.id, 2000);
            if (mounted) setUserStatus(status);
          }
        } else {
          setIsAdmin(false);
          setUserStatus(null);
        }

        if (mounted) setLoading(false);
      }
    );

    initAuth();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (!error && data.user) {
      const adminStatus = checkAdminStatus(data.user.email);
      return { error: null, isAdmin: adminStatus };
    }
    
    return { error, isAdmin: false };
  };

  const signUp = async (email: string, password: string) => {
    if (isAdminEmail(email)) {
      return { error: { message: 'This email is reserved.' } };
    }
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/home` }
    });
    return { error };
  };

  const signOut = async () => {
    setIsAdmin(false);
    setSession(null);
    setUser(null);
    setUserStatus(null);
    
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.warn('signOut failed:', err);
      // Clear auth tokens manually
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-') && key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
    }
    
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
