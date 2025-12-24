
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Shield, Eye, EyeOff } from 'lucide-react';

const AdminAuth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { signIn, user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if already logged in as admin
    if (!authLoading && user && isAdmin) {
      navigate('/admin/dashboard');
    }
    // If logged in but not admin, sign them out and stay here
    if (!authLoading && user && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "This login is for admin only.",
        variant: "destructive"
      });
    }
  }, [user, isAdmin, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { error, isAdmin: isAdminUser } = await signIn(email, password);
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        if (isAdminUser) {
          toast({
            title: "Success",
            description: "Admin signed in successfully!"
          });
          navigate('/admin/dashboard');
        } else {
          toast({
            title: "Access Denied",
            description: "This login is for admin only. Please use the regular sign-in.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth status
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-[#f1f1f1]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo/Brand Section */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#cc0000] to-[#aa0000] mb-6 shadow-lg shadow-red-900/30">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-[#f1f1f1] tracking-tight">Admin Portal</h1>
          <p className="text-[#aaaaaa] mt-3 text-lg">
            Secure admin access only
          </p>
        </div>

        <Card className="bg-[#181818] border-[#272727] shadow-xl">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="text-2xl text-center text-[#f1f1f1]">
              🔐 Admin Login
            </CardTitle>
            <CardDescription className="text-center text-[#aaaaaa] text-base">
              Enter your admin credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#f1f1f1]">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#aaaaaa] w-5 h-5" />
                  <Input
                    type="email"
                    placeholder="Enter admin email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="pl-10 bg-[#212121] border-[#272727] text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#cc0000] focus:ring-[#cc0000]"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#f1f1f1]">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#aaaaaa] w-5 h-5" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="pl-10 pr-10 bg-[#212121] border-[#272727] text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#cc0000] focus:ring-[#cc0000]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#aaaaaa] hover:text-[#f1f1f1]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-[#cc0000] hover:bg-[#aa0000] text-white font-semibold py-3 text-lg transition-all duration-200 hover:scale-[1.02]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Signing In...
                  </span>
                ) : (
                  '→ Admin Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Trust indicators */}
        <div className="text-center space-y-2">
          <p className="text-[#666666] text-sm">
            🔒 Secure admin authentication
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;
