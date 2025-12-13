
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';

interface ProvenNiche {
  id: string;
  name: string;
  image_url: string;
  created_at: string;
  updated_at: string;
}

const ProvenNichesContent = () => {
  const { data: niches, isLoading, error } = useQuery({
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

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8">Proven Niches</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="bg-[#1a1a1a] border-[#272727] animate-pulse">
                <CardContent className="p-0">
                  <div className="aspect-square bg-[#272727] rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8">Proven Niches</h1>
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
            <p className="text-red-400">Failed to load proven niches. Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Proven Niches</h1>
        <p className="text-[#aaaaaa] mb-8">Discover the most successful niches on YouTube</p>
        
        {niches && niches.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {niches.map((niche) => (
              <Card 
                key={niche.id} 
                className="bg-transparent border-none hover:scale-105 transition-all duration-300 group cursor-pointer overflow-hidden"
              >
                <CardContent className="p-0">
                  <div className="relative aspect-square rounded-2xl overflow-hidden shadow-2xl">
                    {/* Main Image */}
                    <img
                      src={niche.image_url}
                      alt={niche.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=500&h=500&fit=crop';
                      }}
                    />
                    
                    {/* Cinematic Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />
                    
                    {/* Text Overlay */}
                    <div className="absolute inset-0 flex items-end justify-center p-4">
                      <div className="text-center">
                        <h3 className="text-white font-bold text-lg md:text-xl leading-tight drop-shadow-2xl">
                          {niche.name}
                        </h3>
                        <div className="w-12 h-0.5 bg-[#cc0000] mx-auto mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                    </div>
                    
                    {/* Subtle Border Glow */}
                    <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 group-hover:ring-[#cc0000]/30 transition-all duration-300" />
                    
                    {/* Hover Effect Overlay */}
                    <div className="absolute inset-0 bg-[#cc0000]/0 group-hover:bg-[#cc0000]/10 transition-colors duration-300" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="bg-[#1a1a1a] border border-[#272727] rounded-2xl p-8 max-w-md mx-auto">
              <p className="text-[#aaaaaa] text-lg mb-2">No proven niches available yet.</p>
              <p className="text-[#666666] text-sm">Check back later for new additions.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProvenNichesContent;
