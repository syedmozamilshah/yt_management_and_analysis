
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import AdminStats from "./pages/AdminStats";
import AdminUsers from "./pages/AdminUsers";
import Home from "./pages/Home";
import Favorites from "./pages/Favorites";
import ChannelTrackerPage from "./pages/ChannelTracker";
import Tools from "./pages/Tools";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import NotFound from "./pages/NotFound";
import PendingApproval from "./pages/PendingApproval";
import BlockedAccount from "./pages/BlockedAccount";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable refetch on window focus to prevent loading skeleton flicker
      refetchOnWindowFocus: false,
      // Keep data fresh for 2 minutes before considering it stale
      staleTime: 2 * 60 * 1000,
      // Keep cached data for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Allow refetch on mount - individual queries can override this
      refetchOnMount: true,
      // Retry failed requests only once
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/blocked" element={<BlockedAccount />} />
            
            {/* Protected routes for authenticated users */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
            <Route path="/channel-tracker" element={<ProtectedRoute><ChannelTrackerPage /></ProtectedRoute>} />
            <Route path="/tools" element={<ProtectedRoute><Tools /></ProtectedRoute>} />
            
            {/* Admin login route - email/password based */}
            <Route path="/admin" element={<AdminAuth />} />
            
            {/* Admin only routes - protected dashboard */}
            <Route path="/admin/dashboard" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path="/admin-stats" element={<AdminRoute><AdminStats /></AdminRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
