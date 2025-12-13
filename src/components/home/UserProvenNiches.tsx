
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Edit, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface UserNiche {
  id: string;
  name: string;
  image_url: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const UserProvenNiches = () => {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNiche, setEditingNiche] = useState<UserNiche | null>(null);
  const [formData, setFormData] = useState({ name: '', image_url: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: niches, isLoading } = useQuery({
    queryKey: ['user-niches', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await (supabase as any)
        .from('user_niches')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      return data as UserNiche[];
    },
    enabled: !!user?.id
  });

  const addNicheMutation = useMutation({
    mutationFn: async (data: { name: string; image_url: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data: result, error } = await (supabase as any)
        .from('user_niches')
        .insert([{ ...data, user_id: user.id }])
        .select();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-niches', user?.id] });
      toast({ title: 'Success', description: 'Niche added successfully' });
      setIsDialogOpen(false);
      setFormData({ name: '', image_url: '' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to add niche',
        variant: 'destructive'
      });
    }
  });

  const updateNicheMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; image_url: string } }) => {
      const { error } = await (supabase as any)
        .from('user_niches')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-niches', user?.id] });
      toast({ title: 'Success', description: 'Niche updated successfully' });
      setEditingNiche(null);
      setFormData({ name: '', image_url: '' });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update niche',
        variant: 'destructive'
      });
    }
  });

  const deleteNicheMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('user_niches')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-niches', user?.id] });
      toast({ title: 'Success', description: 'Niche deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete niche',
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.image_url.trim()) {
      toast({ 
        title: 'Error', 
        description: 'Please fill in all fields',
        variant: 'destructive'
      });
      return;
    }

    if (editingNiche) {
      updateNicheMutation.mutate({ id: editingNiche.id, data: formData });
    } else {
      addNicheMutation.mutate(formData);
    }
  };

  const openAddDialog = () => {
    setEditingNiche(null);
    setFormData({ name: '', image_url: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (niche: UserNiche) => {
    setEditingNiche(niche);
    setFormData({ name: niche.name, image_url: niche.image_url });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingNiche(null);
    setFormData({ name: '', image_url: '' });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-[#cc0000] rounded-full flex items-center justify-center mx-auto mb-4">
          <Target className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-[#f1f1f1] mb-2">My Niches 🎯</h2>
        <p className="text-[#aaaaaa] text-lg">
          Save and organize your proven niches with custom images
        </p>
      </div>

      {/* Add Niche Button */}
      <div className="flex justify-center mb-6">
        <Button
          onClick={openAddDialog}
          className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Niche
        </Button>
      </div>

      {/* Niches Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-[#aaaaaa]">Loading niches...</div>
      ) : niches && niches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {niches.map((niche) => (
            <Card 
              key={niche.id} 
              className="bg-[#181818] border-[#272727] overflow-hidden group hover:border-[#cc0000]/50 transition-colors"
            >
              <div className="relative h-40">
                <img
                  src={niche.image_url}
                  alt={niche.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-[#f1f1f1] font-semibold text-lg">{niche.name}</h3>
                </div>
              </div>
              <CardContent className="p-3 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditDialog(niche)}
                  className="text-[#aaaaaa] hover:text-[#f1f1f1] hover:bg-[#272727]"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#181818] border-[#272727]">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-[#f1f1f1]">Delete Niche</AlertDialogTitle>
                      <AlertDialogDescription className="text-[#aaaaaa]">
                        Are you sure you want to delete "{niche.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-[#272727] text-[#f1f1f1] border-[#272727] hover:bg-[#333333]">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteNicheMutation.mutate(niche.id)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-[#181818] border-[#272727]">
          <CardContent className="p-12 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-2xl font-bold text-[#f1f1f1] mb-2">No Niches Yet!</h3>
            <p className="text-[#aaaaaa] mb-4">
              Start by adding your first proven niche
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#181818] border-[#272727]">
          <DialogHeader>
            <DialogTitle className="text-[#f1f1f1]">
              {editingNiche ? 'Edit Niche' : 'Add New Niche'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#aaaaaa] mb-2">
                Niche Name
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Tech Reviews, Gaming, Fitness"
                className="bg-[#212121] border-[#272727] text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#cc0000]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#aaaaaa] mb-2">
                Image URL
              </label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="bg-[#212121] border-[#272727] text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#cc0000]"
              />
            </div>
            {formData.image_url && (
              <div>
                <label className="block text-sm font-medium text-[#aaaaaa] mb-2">Preview</label>
                <img
                  src={formData.image_url}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded border border-[#272727]"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={closeDialog}
                className="text-[#aaaaaa] hover:text-[#f1f1f1] hover:bg-[#272727]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addNicheMutation.isPending || updateNicheMutation.isPending}
                className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
              >
                {addNicheMutation.isPending || updateNicheMutation.isPending
                  ? 'Saving...'
                  : editingNiche
                  ? 'Update Niche'
                  : 'Add Niche'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserProvenNiches;
