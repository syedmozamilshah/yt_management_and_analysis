
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, TrendingUp, Eye, EyeOff, Sparkles, Video, Users, BarChart3 } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { signIn, signUp, user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Feature highlights for signup
  const features = [
    { icon: Video, text: 'Track viral videos' },
    { icon: BarChart3, text: 'Channel analytics' },
    { icon: Sparkles, text: 'AI title generator' },
    { icon: Users, text: 'Competitor insights' },
  ];

  useEffect(() => {
    // Redirect logged in users
    if (!authLoading && user) {
      if (isAdmin) {
        navigate('/admin');
      } else {
        navigate('/home');
      }
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
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Success",
            description: "Account created! Please check your email for verification."
          });
        }
      } else {
        const { error, isAdmin: isAdminUser } = await signIn(email, password);
        if (error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Success",
            description: "Signed in successfully!"
          });
          // Navigate based on admin status
          if (isAdminUser) {
            navigate('/admin');
          } else {
            navigate('/home');
          }
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
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-[#f1f1f1] tracking-tight">Video Stash</h1>
          <p className="text-[#aaaaaa] mt-3 text-lg">
            {isSignUp 
              ? 'Join thousands of creators tracking viral content'
              : 'Your YouTube Analytics Dashboard'
            }
          </p>
        </div>

        {/* Feature highlights for signup */}
        {isSignUp && (
          <div className="grid grid-cols-2 gap-3">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="flex items-center gap-2 bg-[#181818] border border-[#272727] rounded-lg p-3"
              >
                <feature.icon className="w-4 h-4 text-[#cc0000]" />
                <span className="text-[#f1f1f1] text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
        )}

        <Card className="bg-[#181818] border-[#272727] shadow-xl">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="text-2xl text-center text-[#f1f1f1]">
              {isSignUp ? '🚀 Create Your Account' : '👋 Welcome Back!'}
            </CardTitle>
            <CardDescription className="text-center text-[#aaaaaa] text-base">
              {isSignUp 
                ? 'Start discovering viral content and grow your channel'
                : 'Sign in to continue tracking your progress'
              }
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
                    placeholder="Enter your email"
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
                    placeholder="Enter your password"
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
                    {isSignUp ? 'Creating Account...' : 'Signing In...'}
                  </span>
                ) : (
                  isSignUp ? '🚀 Create Account' : '→ Sign In'
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#272727]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-[#181818] px-2 text-[#666666]">or</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="mt-4 text-[#cc0000] hover:text-[#aa0000] font-medium transition-colors"
                disabled={loading}
              >
                {isSignUp 
                  ? '← Already have an account? Sign In' 
                  : "Don't have an account? Sign Up →"
                }
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Trust indicators */}
        <div className="text-center space-y-2">
          <p className="text-[#666666] text-sm">
            🔒 Your data is secure and encrypted
          </p>
          <p className="text-[#555555] text-xs">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
