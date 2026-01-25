import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  UserPlus, 
  UserCheck, 
  UserX, 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle,
  Loader2,
  RefreshCw,
  CheckSquare,
  Search
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserProfile {
  id: string;
  email: string | null;
  is_admin: boolean;
  user_status: 'pending' | 'approved' | 'blocked';
  created_at: string;
  updated_at: string;
}

type TabType = 'new' | 'approved' | 'blocked';

const UserManagement: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('new');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    userId: string;
    action: 'approve' | 'reject' | 'block' | 'unblock';
    userName: string;
  } | null>(null);
  const [bulkConfirmDialog, setBulkConfirmDialog] = useState<{
    open: boolean;
    action: 'approve' | 'block';
    count: number;
  } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers((data as UserProfile[]) || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Clear selection when tab changes
  useEffect(() => {
    setSelectedUsers(new Set());
    setSearchQuery('');
  }, [activeTab]);

  const updateUserStatus = async (userId: string, newStatus: 'approved' | 'blocked' | 'pending') => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ user_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `User has been ${newStatus === 'approved' ? 'approved' : newStatus === 'blocked' ? 'blocked' : 'set to pending'}`
      });

      // Refresh user list
      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user status',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const handleAction = (userId: string, action: 'approve' | 'reject' | 'block' | 'unblock', email: string | null) => {
    setConfirmDialog({
      open: true,
      userId,
      action,
      userName: email || 'this user'
    });
  };

  const confirmAction = () => {
    if (!confirmDialog) return;
    
    const { userId, action } = confirmDialog;
    switch (action) {
      case 'approve':
      case 'unblock':
        updateUserStatus(userId, 'approved');
        break;
      case 'reject':
      case 'block':
        updateUserStatus(userId, 'blocked');
        break;
    }
  };

  const getActionMessage = () => {
    if (!confirmDialog) return '';
    switch (confirmDialog.action) {
      case 'approve':
        return `Are you sure you want to approve ${confirmDialog.userName}? They will be able to access the dashboard.`;
      case 'reject':
        return `Are you sure you want to reject ${confirmDialog.userName}? They will not be able to access the dashboard.`;
      case 'block':
        return `Are you sure you want to block ${confirmDialog.userName}? They will be immediately logged out and unable to access the dashboard.`;
      case 'unblock':
        return `Are you sure you want to unblock ${confirmDialog.userName}? They will be able to access the dashboard again.`;
      default:
        return '';
    }
  };

  // Bulk update function
  const bulkUpdateUserStatus = async (userIds: string[], newStatus: 'approved' | 'blocked') => {
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ user_status: newStatus, updated_at: new Date().toISOString() })
        .in('id', userIds);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${userIds.length} user(s) have been ${newStatus === 'approved' ? 'approved' : 'blocked'}`
      });

      setSelectedUsers(new Set());
      fetchUsers();
    } catch (error) {
      console.error('Error bulk updating users:', error);
      toast({
        title: 'Error',
        description: 'Failed to update users',
        variant: 'destructive'
      });
    } finally {
      setBulkLoading(false);
      setBulkConfirmDialog(null);
    }
  };

  const handleBulkAction = (action: 'approve' | 'block') => {
    setBulkConfirmDialog({
      open: true,
      action,
      count: selectedUsers.size
    });
  };

  const confirmBulkAction = () => {
    if (!bulkConfirmDialog) return;
    const userIds = Array.from(selectedUsers);
    bulkUpdateUserStatus(userIds, bulkConfirmDialog.action === 'approve' ? 'approved' : 'blocked');
  };

  const toggleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  // Filter users based on active tab and search query
  const filteredUsers = users.filter(user => {
    if (user.is_admin) return false; // Don't show admin in user management
    
    // Tab filter
    let tabMatch = false;
    if (activeTab === 'new') tabMatch = user.user_status === 'pending';
    else if (activeTab === 'approved') tabMatch = user.user_status === 'approved';
    else if (activeTab === 'blocked') tabMatch = user.user_status === 'blocked';
    
    if (!tabMatch) return false;
    
    // Search filter - case insensitive email search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      return user.email?.toLowerCase().includes(query) || false;
    }
    
    return true;
  });

  const pendingCount = users.filter(u => u.user_status === 'pending' && !u.is_admin).length;
  const approvedCount = users.filter(u => u.user_status === 'approved' && !u.is_admin).length;
  const blockedCount = users.filter(u => u.user_status === 'blocked' && !u.is_admin).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approved</Badge>;
      case 'blocked':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Blocked</Badge>;
      case 'pending':
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#cc0000] to-[#aa0000] flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">User Management</h2>
            <p className="text-[#888888]">Approve new signups and manage user access</p>
          </div>
        </div>
        <Button
          onClick={fetchUsers}
          variant="ghost"
          size="sm"
          className="text-[#888888] hover:text-white"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-[#181818] p-1 rounded-lg w-fit">
        <Button
          onClick={() => setActiveTab('new')}
          variant="ghost"
          className={`relative flex items-center gap-2 ${
            activeTab === 'new'
              ? 'bg-[#cc0000] text-white hover:bg-[#aa0000]'
              : 'text-[#aaaaaa] hover:text-white hover:bg-[#272727]'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Pending
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#cc0000] text-white text-xs rounded-full flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </Button>
        <Button
          onClick={() => setActiveTab('approved')}
          variant="ghost"
          className={`relative flex items-center gap-2 ${
            activeTab === 'approved'
              ? 'bg-[#cc0000] text-white hover:bg-[#aa0000]'
              : 'text-[#aaaaaa] hover:text-white hover:bg-[#272727]'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Approved
          {approvedCount > 0 && (
            <span className="ml-1 text-xs opacity-70">({approvedCount})</span>
          )}
        </Button>
        <Button
          onClick={() => setActiveTab('blocked')}
          variant="ghost"
          className={`relative flex items-center gap-2 ${
            activeTab === 'blocked'
              ? 'bg-[#cc0000] text-white hover:bg-[#aa0000]'
              : 'text-[#aaaaaa] hover:text-white hover:bg-[#272727]'
          }`}
        >
          <UserX className="w-4 h-4" />
          Blocked
          {blockedCount > 0 && (
            <span className="ml-1 text-xs opacity-70">({blockedCount})</span>
          )}
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#666666]" />
        <Input
          placeholder="Search by email address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#181818] border-[#272727] text-white placeholder:text-[#666666] focus:border-[#cc0000] focus:ring-[#cc0000]/20"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#666666] hover:text-white"
          >
            ×
          </button>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedUsers.size > 0 && (
        <div className="flex items-center justify-between bg-[#1a1a2e] p-4 rounded-xl border border-[#272727]">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-[#cc0000]" />
            <span className="text-white font-medium">{selectedUsers.size} user(s) selected</span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleBulkAction('approve')}
              disabled={bulkLoading}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-1"
            >
              {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Allow Selected
            </Button>
            <Button
              onClick={() => handleBulkAction('block')}
              disabled={bulkLoading}
              size="sm"
              variant="destructive"
              className="gap-1"
            >
              {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Block Selected
            </Button>
            <Button
              onClick={() => setSelectedUsers(new Set())}
              disabled={bulkLoading}
              size="sm"
              variant="ghost"
              className="text-[#888888] hover:text-white"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* User List */}
      <div className="bg-[#181818] rounded-xl border border-[#272727] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#cc0000] animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-[#272727] flex items-center justify-center mx-auto mb-4">
              {searchQuery ? (
                <Search className="w-8 h-8 text-[#666666]" />
              ) : activeTab === 'new' ? (
                <Clock className="w-8 h-8 text-[#666666]" />
              ) : (
                <Users className="w-8 h-8 text-[#666666]" />
              )}
            </div>
            <p className="text-[#888888]">
              {searchQuery 
                ? `No users found matching "${searchQuery}"` 
                : activeTab === 'new' 
                  ? 'No pending user requests' 
                  : 'No users found'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#272727]">
            {/* Select All Header */}
            <div className="flex items-center gap-4 p-4 bg-[#1a1a1a]">
              <Checkbox
                checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                onCheckedChange={toggleSelectAll}
                className="border-[#404040] data-[state=checked]:bg-[#cc0000] data-[state=checked]:border-[#cc0000]"
              />
              <span className="text-[#888888] text-sm font-medium">
                {selectedUsers.size === filteredUsers.length && filteredUsers.length > 0 
                  ? 'Deselect All' 
                  : `Select All (${filteredUsers.length})`}
              </span>
            </div>
            
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`flex items-center justify-between p-4 hover:bg-[#1f1f1f] transition-colors ${
                  selectedUsers.has(user.id) ? 'bg-[#1a1a2e]' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedUsers.has(user.id)}
                    onCheckedChange={() => toggleSelectUser(user.id)}
                    className="border-[#404040] data-[state=checked]:bg-[#cc0000] data-[state=checked]:border-[#cc0000]"
                  />
                  <div className="w-10 h-10 rounded-full bg-[#272727] flex items-center justify-center">
                    <Shield className="w-5 h-5 text-[#666666]" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{user.email || 'No email'}</p>
                    <p className="text-sm text-[#666666]">Joined {formatDate(user.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(user.user_status)}
                  
                  {activeTab === 'new' ? (
                    // New users: Show Approve/Reject
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAction(user.id, 'approve', user.email)}
                        disabled={actionLoading === user.id}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white gap-1"
                      >
                        {actionLoading === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Allow
                      </Button>
                      <Button
                        onClick={() => handleAction(user.id, 'reject', user.email)}
                        disabled={actionLoading === user.id}
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                      >
                        {actionLoading === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Disallow
                      </Button>
                    </div>
                  ) : (
                    // Existing users: Show Block/Unblock
                    <div className="flex gap-2">
                      {user.user_status === 'blocked' ? (
                        <Button
                          onClick={() => handleAction(user.id, 'unblock', user.email)}
                          disabled={actionLoading === user.id}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white gap-1"
                        >
                          {actionLoading === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                          Unblock
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleAction(user.id, 'block', user.email)}
                          disabled={actionLoading === user.id}
                          size="sm"
                          variant="destructive"
                          className="gap-1"
                        >
                          {actionLoading === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserX className="w-4 h-4" />
                          )}
                          Block
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent className="bg-[#181818] border-[#272727]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white capitalize">
              {confirmDialog?.action} User
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#aaaaaa]">
              {getActionMessage()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#272727] text-white border-[#404040] hover:bg-[#333333]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={`text-white ${
                confirmDialog?.action === 'approve' || confirmDialog?.action === 'unblock'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-[#cc0000] hover:bg-[#aa0000]'
              }`}
            >
              {confirmDialog?.action === 'approve' || confirmDialog?.action === 'unblock' ? 'Confirm' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Confirmation Dialog */}
      <AlertDialog open={bulkConfirmDialog?.open} onOpenChange={(open) => !open && setBulkConfirmDialog(null)}>
        <AlertDialogContent className="bg-[#181818] border-[#272727]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {bulkConfirmDialog?.action === 'approve' ? 'Approve' : 'Block'} {bulkConfirmDialog?.count} Users
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#aaaaaa]">
              Are you sure you want to {bulkConfirmDialog?.action === 'approve' ? 'approve' : 'block'} {bulkConfirmDialog?.count} selected user(s)?
              {bulkConfirmDialog?.action === 'block' && ' They will be immediately logged out and unable to access the dashboard.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#272727] text-white border-[#404040] hover:bg-[#333333]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkAction}
              className={`text-white ${
                bulkConfirmDialog?.action === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-[#cc0000] hover:bg-[#aa0000]'
              }`}
            >
              {bulkConfirmDialog?.action === 'approve' ? 'Approve All' : 'Block All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagement;
