import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NicheComboboxProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showAllUsers?: boolean;
}

export const NicheCombobox: React.FC<NicheComboboxProps> = ({ 
  value, 
  onChange, 
  disabled = false, 
  placeholder = "Select or create a niche...",
  showAllUsers = false
}) => {
  const { user, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [niches, setNiches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch existing niches from user_videos table
  useEffect(() => {
    const fetchNiches = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      try {
        let query = (supabase as any)
          .from('user_videos')
          .select('niche')
          .not('niche', 'is', null);
        
        // If not showing all users data (or not admin), filter by user
        if (!showAllUsers || !isAdmin) {
          query = query.eq('user_id', user.id);
        }
        
        const { data, error } = await query;

        if (error) throw error;

        // Get unique niches
        const uniqueNiches: string[] = [...new Set(
          (data || [])
            .map((v: { niche: string | null }) => v.niche)
            .filter((n: string | null): n is string => n !== null && n.trim() !== '')
        )].sort() as string[];
        
        setNiches(uniqueNiches);
      } catch (error) {
        console.error('Error fetching niches:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNiches();
  }, [user?.id, showAllUsers, isAdmin]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter niches based on input
  const filteredNiches = niches.filter(niche => 
    niche.toLowerCase().includes(value.toLowerCase())
  );

  // Check if the current value is a new niche (not in existing list)
  const isNewNiche = value.trim() !== '' && 
    !niches.some(n => n.toLowerCase() === value.toLowerCase());

  const handleSelectNiche = (niche: string) => {
    onChange(niche);
    setIsOpen(false);
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label htmlFor="niche-combobox" className="text-white font-medium">
        Niche <span className="text-red-400">*</span>
      </Label>
      <div className="relative">
        <Input
          id="niche-combobox"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="bg-[#0f0f0f] border-[#272727] text-white placeholder:text-[#666666] focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000] pr-10"
          autoComplete="off"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-[#666666] hover:text-white hover:bg-[#272727]"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>

        {/* Dropdown */}
        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-[#181818] border border-[#272727] rounded-lg shadow-xl max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#404040] scrollbar-track-[#181818]">
            {loading ? (
              <div className="p-3 text-center text-[#666666] text-sm">
                Loading niches...
              </div>
            ) : (
              <>
                {/* Show "Create new" option if typing a new niche */}
                {isNewNiche && (
                  <div
                    onClick={() => handleSelectNiche(value.trim())}
                    className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-[#272727] border-b border-[#272727] text-[#cc0000]"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Create "{value.trim()}"</span>
                  </div>
                )}
                
                {/* Existing niches */}
                {filteredNiches.length > 0 ? (
                  filteredNiches.map((niche) => (
                    <div
                      key={niche}
                      onClick={() => handleSelectNiche(niche)}
                      className={`flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-[#272727] text-white text-sm ${
                        value.toLowerCase() === niche.toLowerCase() ? 'bg-[#272727]' : ''
                      }`}
                    >
                      <span>{niche}</span>
                      {value.toLowerCase() === niche.toLowerCase() && (
                        <Check className="w-4 h-4 text-[#cc0000]" />
                      )}
                    </div>
                  ))
                ) : !isNewNiche ? (
                  <div className="p-3 text-center text-[#666666] text-sm">
                    {niches.length === 0 
                      ? "No niches yet. Type to create one!"
                      : "No matching niches. Type to create a new one!"}
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
      <p className="text-[#aaaaaa] text-xs">
        Select an existing niche or type a new one
      </p>
    </div>
  );
};
