import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

interface ProvenNiche {
  id: string;
  name: string;
  image_url: string;
  created_at: string;
  updated_at: string;
}

const ProvenNichesSection = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNiche, setEditingNiche] = useState<ProvenNiche | null>(null);
  const [formData, setFormData] = useState({ name: '', image_url: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: niches, isLoading } = useQuery({
    queryKey: ['admin-proven-niches'],
    queryFn: async () => {
      console.log('Fetching proven niches...');
      const { data, error } = await supabase
        .from('proven_niches')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching niches:', error);
        throw error;
      }
      console.log('Fetched niches:', data);
      return data as ProvenNiche[];
    }
  });

  const addNicheMutation = useMutation({
    mutationFn: async (data: { name: string; image_url: string }) => {
      console.log('Adding niche with data:', data);
      const { data: result, error } = await supabase
        .from('proven_niches')
        .insert([data])
        .select();
      
      if (error) {
        console.error('Error adding niche:', error);
        throw error;
      }
      console.log('Successfully added niche:', result);
      return result;
    },
    onSuccess: () => {
      console.log('Add mutation successful, invalidating queries...');
      queryClient.invalidateQueries({ queryKey: ['admin-proven-niches'] });
      queryClient.invalidateQueries({ queryKey: ['proven-niches'] });
      toast({ title: 'Success', description: 'Niche added successfully' });
      setIsDialogOpen(false);
      setFormData({ name: '', image_url: '' });
    },
    onError: (error: any) => {
      console.error('Add mutation error:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to add niche',
        variant: 'destructive'
      });
    }
  });

  const updateNicheMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; image_url: string } }) => {
      console.log('Updating niche:', id, 'with data:', data);
      const { error } = await supabase
        .from('proven_niches')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        console.error('Error updating niche:', error);
        throw error;
      }
      console.log('Successfully updated niche');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-proven-niches'] });
      queryClient.invalidateQueries({ queryKey: ['proven-niches'] });
      toast({ title: 'Success', description: 'Niche updated successfully' });
      setEditingNiche(null);
      setFormData({ name: '', image_url: '' });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      console.error('Update mutation error:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update niche',
        variant: 'destructive'
      });
    }
  });

  const deleteNicheMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting niche:', id);
      const { error } = await supabase
        .from('proven_niches')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting niche:', error);
        throw error;
      }
      console.log('Successfully deleted niche');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-proven-niches'] });
      queryClient.invalidateQueries({ queryKey: ['proven-niches'] });
      toast({ title: 'Success', description: 'Niche deleted successfully' });
    },
    onError: (error: any) => {
      console.error('Delete mutation error:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete niche',
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with data:', formData);
    
    if (!formData.name.trim() || !formData.image_url.trim()) {
      console.log('Form validation failed - missing fields');
      toast({ 
        title: 'Error', 
        description: 'Please fill in all fields',
        variant: 'destructive'
      });
      return;
    }

    if (editingNiche) {
      console.log('Updating existing niche:', editingNiche.id);
      updateNicheMutation.mutate({ id: editingNiche.id, data: formData });
    } else {
      console.log('Adding new niche');
      addNicheMutation.mutate(formData);
    }
  };

  const openAddDialog = () => {
    console.log('Opening add dialog');
    setEditingNiche(null);
    setFormData({ name: '', image_url: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (niche: ProvenNiche) => {
    console.log('Opening edit dialog for niche:', niche);
    setEditingNiche(niche);
    setFormData({ name: niche.name, image_url: niche.image_url });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    console.log('Closing dialog');
    setIsDialogOpen(false);
    setEditingNiche(null);
    setFormData({ name: '', image_url: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Manage Proven Niches</h2>
        <Button 
          onClick={openAddDialog}
          className="bg-[#cc0000] hover:bg-[#aa0000] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Niche
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="bg-[#1a1a1a] border-[#272727] text-white">
          <DialogHeader>
            <DialogTitle>{editingNiche ? 'Edit' : 'Add'} Proven Niche</DialogTitle>
            <DialogDescription className="text-[#aaaaaa]">
              {editingNiche ? 'Update the details of this proven niche.' : 'Add a new proven niche to the collection.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Niche Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter niche name"
                className="bg-[#272727] border-[#404040] text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Image URL</label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="Enter image URL"
                className="bg-[#272727] border-[#404040] text-white"
              />
            </div>
            {formData.image_url && (
              <div>
                <label className="block text-sm font-medium mb-2">Preview</label>
                <img
                  src={formData.image_url}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded border border-[#404040]"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                className="flex-1 bg-[#cc0000] hover:bg-[#aa0000]"
                disabled={addNicheMutation.isPending || updateNicheMutation.isPending}
              >
                {editingNiche ? 'Update' : 'Add'} Niche
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={closeDialog}
                className="border-[#404040] text-white hover:bg-[#272727]"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-[#1a1a1a] border-[#272727] animate-pulse">
              <CardContent className="p-4">
                <div className="aspect-video bg-[#272727] rounded mb-3" />
                <div className="h-5 bg-[#272727] rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {niches?.map((niche) => (
            <Card key={niche.id} className="bg-[#1a1a1a] border-[#272727]">
              <CardContent className="p-4">
                <div className="aspect-video relative mb-3 rounded overflow-hidden">
                  <img
                    src={niche.image_url}
                    alt={niche.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=400&h=225&fit=crop';
                    }}
                  />
                </div>
                <h3 className="text-white font-semibold mb-3">{niche.name}</h3>
                <div className="flex gap-2">
                  <Button
                    onClick={() => openEditDialog(niche)}
                    size="sm"
                    variant="outline"
                    className="flex-1 border-[#404040] text-white hover:bg-[#272727]"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#cc0000] text-[#cc0000] hover:bg-[#cc0000] hover:text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#1a1a1a] border-[#272727] text-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Niche</AlertDialogTitle>
                        <AlertDialogDescription className="text-[#aaaaaa]">
                          Are you sure you want to delete "{niche.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-[#404040] text-white hover:bg-[#272727]">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteNicheMutation.mutate(niche.id)}
                          className="bg-[#cc0000] hover:bg-[#aa0000]"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {niches && niches.length === 0 && (
        <Card className="bg-[#1a1a1a] border-[#272727]">
          <CardContent className="p-8 text-center">
            <p className="text-[#aaaaaa]">No proven niches created yet.</p>
            <p className="text-[#666666] text-sm mt-1">Click "Add Niche" to create your first one.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProvenNichesSection;
