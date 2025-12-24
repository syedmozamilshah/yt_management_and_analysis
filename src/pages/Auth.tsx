import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, TrendingUp, Sparkles, Video, Users, BarChart3, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Feature highlights
  const features = [
    { icon: Video, text: 'Track viral videos', description: 'Monitor trending content' },
    { icon: BarChart3, text: 'Channel analytics', description: 'Deep performance insights' },
    { icon: Sparkles, text: 'AI title generator', description: 'Create viral titles' },
    { icon: Users, text: 'Competitor insights', description: 'Stay ahead of competition' },
  ];

  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin) {
        navigate('/admin/dashboard');
      } else {
        navigate('/home');
      }
    }
  }, [user, isAdmin, authLoading, navigate]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive"
      });
      return;
    }

    // Check if it's admin email
    if (email.toLowerCase() === 'admin@videostash.com') {
      toast({
        title: "Admin Account",
        description: "Please use the admin login at /admin-login",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Don't include emailRedirectTo - this sends OTP code instead of magic link
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setStep('otp');
        toast({
          title: "Check your email! 📧",
          description: "We've sent a 6-digit verification code."
        });
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otp.trim() || otp.length !== 6) {
      toast({
        title: "Error",
        description: "Please enter the 6-digit code from your email",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'email'
      });

      if (error) {
        toast({
          title: "Invalid Code",
          description: "The code you entered is incorrect or expired. Please try again.",
          variant: "destructive"
        });
      } else if (data.user) {
        toast({
          title: "Welcome! 🎉",
          description: "You're now signed in."
        });
        navigate('/home');
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

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setOtp('');
        toast({
          title: "Code Resent! 📧",
          description: "Check your email for the new verification code."
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resend code",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#cc0000] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex">
      {/* Left side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0f0f0f] via-[#1a0a0a] to-[#0f0f0f] p-12 flex-col justify-between relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#cc0000]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#cc0000]/5 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#cc0000] to-[#aa0000] flex items-center justify-center shadow-lg shadow-red-900/30">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-[#f1f1f1]">Video Stash</span>
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold text-[#f1f1f1] leading-tight mb-6">
            Your YouTube<br />
            <span className="text-[#cc0000]">Analytics Hub</span>
          </h1>
          <p className="text-[#888888] text-lg max-w-md">
            Track competitors, analyze channels, and generate viral titles with AI-powered insights.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="flex items-center gap-4 p-4 rounded-xl bg-[#181818]/50 border border-[#272727]/50 backdrop-blur-sm hover:border-[#cc0000]/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-[#cc0000]/10 flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-[#cc0000]" />
              </div>
              <div>
                <p className="text-[#f1f1f1] font-medium">{feature.text}</p>
                <p className="text-[#666666] text-sm">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#cc0000] to-[#aa0000] flex items-center justify-center shadow-lg shadow-red-900/30">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-[#f1f1f1]">Video Stash</span>
          </div>

          {step === 'email' ? (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-[#f1f1f1] mb-2">Welcome back</h2>
                <p className="text-[#888888]">Enter your email to sign in to your account</p>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#f1f1f1]">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#666666] w-5 h-5" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="h-12 pl-12 bg-[#181818] border-[#272727] text-[#f1f1f1] placeholder:text-[#555555] focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000] rounded-xl"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading || !email.trim()} 
                  className="w-full h-12 bg-[#cc0000] hover:bg-[#aa0000] text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>

              <p className="text-center text-[#555555] text-sm mt-8">
                We'll send you a 6-digit verification code.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOtp('');
                }}
                className="flex items-center gap-2 text-[#888888] hover:text-[#f1f1f1] mb-8 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="mb-8">
                <h2 className="text-3xl font-bold text-[#f1f1f1] mb-2">Enter verification code</h2>
                <p className="text-[#888888]">
                  We sent a 6-digit code to<br />
                  <span className="text-[#f1f1f1] font-medium">{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#f1f1f1]">Verification code</label>
                  <Input
                    type="text"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={loading}
                    maxLength={6}
                    autoFocus
                    className="h-14 bg-[#181818] border-[#272727] text-[#f1f1f1] placeholder:text-[#333333] focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000] rounded-xl text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={loading || otp.length !== 6} 
                  className="w-full h-12 bg-[#cc0000] hover:bg-[#aa0000] text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Verify & Sign In
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="text-center mt-6">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-[#888888] hover:text-[#cc0000] text-sm transition-colors disabled:opacity-50"
                >
                  Didn't receive the code? <span className="font-medium">Resend</span>
                </button>
              </div>
            </>
          )}

          {/* Mobile features */}
          {step === 'email' && (
            <div className="lg:hidden mt-12 pt-8 border-t border-[#272727]">
              <div className="grid grid-cols-2 gap-3">
                {features.map((feature, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-2 p-3 rounded-lg bg-[#181818] border border-[#272727]"
                  >
                    <feature.icon className="w-4 h-4 text-[#cc0000]" />
                    <span className="text-[#f1f1f1] text-xs">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
