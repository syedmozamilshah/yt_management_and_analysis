
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProvenNiche {
  id: string;
  name: string;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export const useProvenNiches = () => {
  return useQuery({
    queryKey: ['proven-niches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proven_niches')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as ProvenNiche[];
    }
  });
};

export const useAddProvenNiche = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; image_url: string }) => {
      const { error } = await supabase
        .from('proven_niches')
        .insert([data]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proven-niches'] });
      queryClient.invalidateQueries({ queryKey: ['admin-proven-niches'] });
    }
  });
};

export const useUpdateProvenNiche = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; image_url: string } }) => {
      const { error } = await supabase
        .from('proven_niches')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proven-niches'] });
      queryClient.invalidateQueries({ queryKey: ['admin-proven-niches'] });
    }
  });
};

export const useDeleteProvenNiche = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('proven_niches')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proven-niches'] });
      queryClient.invalidateQueries({ queryKey: ['admin-proven-niches'] });
    }
  });
};
