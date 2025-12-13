
import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { Filter, Zap, Users, Calendar, RotateCcw, ChevronDown } from 'lucide-react';
import { FilterState, getViewCountBounds, getSubscriberCountBounds } from '@/utils/filterUtils';
import { Video } from '@/types/video';
import { formatNumber } from '@/utils/formatNumbers';

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableNiches: string[];
  filteredCount: number;
  totalCount: number;
  videos: Video[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  availableNiches,
  filteredCount,
  totalCount,
  videos
}) => {
  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Check if any filters are applied
  const hasActiveFilters = useMemo(() => {
    const viewBounds = getViewCountBounds(videos);
    const subscriberBounds = getSubscriberCountBounds(videos);
    
    return (
      filters.viralOnly ||
      filters.selectedNiches !== 'all' ||
      filters.uploadTiming !== 'all' ||
      filters.viewRange[0] !== viewBounds.min ||
      filters.viewRange[1] !== viewBounds.max ||
      filters.subscriberRange[0] !== subscriberBounds.min ||
      filters.subscriberRange[1] !== subscriberBounds.max
    );
  }, [filters, videos]);

  const resetFilters = () => {
    const viewBounds = getViewCountBounds(videos);
    const subscriberBounds = getSubscriberCountBounds(videos);
    onFiltersChange({
      viralOnly: false,
      selectedNiches: 'all',
      channelSizeRange: [],
      uploadTiming: 'all',
      viewRange: [viewBounds.min, viewBounds.max],
      subscriberRange: [subscriberBounds.min, subscriberBounds.max]
    });
  };

  // Calculate bounds from videos
  const viewBounds = useMemo(() => getViewCountBounds(videos), [videos]);
  const subscriberBounds = useMemo(() => getSubscriberCountBounds(videos), [videos]);
  
  // Initialize ranges if not set or if bounds changed
  const currentViewRange = useMemo(() => {
    if (filters.viewRange[0] === 0 && filters.viewRange[1] === 10000000) {
      return [viewBounds.min, viewBounds.max];
    }
    return filters.viewRange;
  }, [filters.viewRange, viewBounds]);

  const currentSubscriberRange = useMemo(() => {
    if (filters.subscriberRange[0] === 0 && filters.subscriberRange[1] === 10000000) {
      return [subscriberBounds.min, subscriberBounds.max];
    }
    return filters.subscriberRange;
  }, [filters.subscriberRange, subscriberBounds]);

  return (
    <div className="bg-[#0f0f0f]/95 backdrop-blur-xl border border-[#272727] rounded-2xl p-6 space-y-6 glass-effect-dark">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Filters</h2>
          <p className="text-sm text-[#aaaaaa]">
            {filteredCount} of {totalCount} videos
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Reset Button - only show when filters are applied */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-[#aaaaaa] hover:text-white hover:bg-[#272727] h-9 px-4 text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Quick Filters Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Views > Subscribers Filter */}
        <Button
          onClick={() => updateFilter('viralOnly', !filters.viralOnly)}
          className={`h-10 px-4 text-sm font-medium rounded-full transition-all border ${
            filters.viralOnly 
              ? 'bg-[#cc0000] text-white border-[#cc0000] hover:bg-[#aa0000]' 
              : 'bg-transparent text-[#f1f1f1] border-[#303030] hover:bg-[#272727] hover:border-[#404040]'
          }`}
        >
          <Zap className="w-4 h-4 mr-2" />
          Views &gt; Subscribers
          {filters.viralOnly && (
            <div className="ml-2 w-2 h-2 bg-white rounded-full" />
          )}
        </Button>

        {/* Niches Filter */}
        <Select value={filters.selectedNiches} onValueChange={(value) => updateFilter('selectedNiches', value)}>
          <SelectTrigger className={`h-10 w-full px-4 text-sm font-medium rounded-full border transition-all ${
            filters.selectedNiches !== 'all'
              ? 'bg-[#cc0000] text-white border-[#cc0000] hover:bg-[#aa0000]'
              : 'bg-transparent text-[#f1f1f1] border-[#303030] hover:bg-[#272727] hover:border-[#404040]'
          }`}>
            <Users className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Niches" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] backdrop-blur-xl border-[#272727] rounded-xl z-50">
            <SelectItem value="all" className="text-[#f1f1f1] hover:bg-[#cc0000] hover:text-white focus:bg-[#cc0000] focus:text-white rounded-lg cursor-pointer">All Niches</SelectItem>
            {availableNiches.map((niche) => (
              <SelectItem key={niche} value={niche} className="text-[#f1f1f1] hover:bg-[#cc0000] hover:text-white focus:bg-[#cc0000] focus:text-white rounded-lg cursor-pointer">{niche}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Upload Timing Filter */}
        <Select value={filters.uploadTiming} onValueChange={(value) => updateFilter('uploadTiming', value)}>
          <SelectTrigger className={`h-10 w-full px-4 text-sm font-medium rounded-full border transition-all ${
            filters.uploadTiming !== 'all'
              ? 'bg-[#cc0000] text-white border-[#cc0000] hover:bg-[#aa0000]'
              : 'bg-transparent text-[#f1f1f1] border-[#303030] hover:bg-[#272727] hover:border-[#404040]'
          }`}>
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Upload Time" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] backdrop-blur-xl border-[#272727] rounded-xl z-50">
            <SelectItem value="all" className="text-[#f1f1f1] hover:bg-[#cc0000] hover:text-white focus:bg-[#cc0000] focus:text-white rounded-lg cursor-pointer">All Time</SelectItem>
            <SelectItem value="7d" className="text-[#f1f1f1] hover:bg-[#cc0000] hover:text-white focus:bg-[#cc0000] focus:text-white rounded-lg cursor-pointer">Last 7 Days</SelectItem>
            <SelectItem value="28d" className="text-[#f1f1f1] hover:bg-[#cc0000] hover:text-white focus:bg-[#cc0000] focus:text-white rounded-lg cursor-pointer">Last 28 Days</SelectItem>
            <SelectItem value="30d" className="text-[#f1f1f1] hover:bg-[#cc0000] hover:text-white focus:bg-[#cc0000] focus:text-white rounded-lg cursor-pointer">Last 30 Days</SelectItem>
            <SelectItem value="60d" className="text-[#f1f1f1] hover:bg-[#cc0000] hover:text-white focus:bg-[#cc0000] focus:text-white rounded-lg cursor-pointer">Last 60 Days</SelectItem>
            <SelectItem value="90d" className="text-[#f1f1f1] hover:bg-[#cc0000] hover:text-white focus:bg-[#cc0000] focus:text-white rounded-lg cursor-pointer">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Range Sliders Section */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Views Range */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#f1f1f1]">Views</label>
              <div className="text-sm font-medium text-[#aaaaaa] bg-[#272727] px-3 py-1.5 rounded-full">
                {formatNumber(currentViewRange[0])} - {formatNumber(currentViewRange[1])}
              </div>
            </div>
            <Slider
              value={currentViewRange}
              onValueChange={(value) => updateFilter('viewRange', value)}
              min={viewBounds.min}
              max={viewBounds.max}
              step={Math.max(1, Math.floor((viewBounds.max - viewBounds.min) / 1000))}
              className="w-full youtube-slider"
            />
          </div>

          {/* Subscribers Range */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#f1f1f1]">Subscribers</label>
              <div className="text-sm font-medium text-[#aaaaaa] bg-[#272727] px-3 py-1.5 rounded-full">
                {formatNumber(currentSubscriberRange[0])} - {formatNumber(currentSubscriberRange[1])}
              </div>
            </div>
            <Slider
              value={currentSubscriberRange}
              onValueChange={(value) => updateFilter('subscriberRange', value)}
              min={subscriberBounds.min}
              max={subscriberBounds.max}
              step={Math.max(1, Math.floor((subscriberBounds.max - subscriberBounds.min) / 1000))}
              className="w-full youtube-slider"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
