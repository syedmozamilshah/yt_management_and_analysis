
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Copy, Star, TrendingUp, RefreshCw, Home, Brain, Target, 
  BarChart3, Users, Eye, Calendar, Award, Zap, Lightbulb,
  Database, Filter, Sparkles, Clock, ThumbsUp, Shuffle, Heart
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatNumber } from '@/utils/formatNumbers';
import { Video } from '@/types/video';

interface GeneratedTitleWithAnalysis {
  title: string;
  adaptedFrom: string;
  patterns: string[];
  statements: string[];
  authorityReplacement: string;
}

interface TitleResultsProps {
  titles: GeneratedTitleWithAnalysis[];
  referenceVideos: Video[];
  onGenerateMore: () => void;
  onStartOver: () => void;
  dataSource?: 'outliers' | 'favorites' | null;
  totalAnalyzed?: number;
}

export const TitleResults: React.FC<TitleResultsProps> = ({
  titles,
  referenceVideos,
  onGenerateMore,
  onStartOver,
  dataSource,
  totalAnalyzed
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('titles');

  // Use totalAnalyzed if provided, otherwise fall back to referenceVideos length
  const videosAnalyzedCount = totalAnalyzed || referenceVideos.length;

  const copyTitle = (title: string) => {
    navigator.clipboard.writeText(title);
    toast({
      title: "Copied! 🎉",
      description: "Title copied to your clipboard - go make that amazing video!"
    });
  };

  // Calculate statistics
  const totalViews = referenceVideos.reduce((sum, video) => sum + (video.view_count || 0), 0);
  const avgViews = totalViews / referenceVideos.length;
  const topVideo = referenceVideos.reduce((max, video) => 
    (video.view_count || 0) > (max.view_count || 0) ? video : max, referenceVideos[0]);
  const uniquePatterns = [...new Set(titles.flatMap(t => t.patterns))];
  const uniqueStatements = [...new Set(titles.flatMap(t => t.statements))];
  const niches = [...new Set(referenceVideos.map(v => v.niche).filter(Boolean))];

  // Performance score calculation
  const performanceScore = Math.min(95, Math.round(
    (videosAnalyzedCount * 5) + // Give more weight to total analyzed
    (uniquePatterns.length * 5) + 
    (uniqueStatements.length * 3) + 
    (titles.length * 2)
  ));

  const getDataSourceInfo = () => {
    if (dataSource === 'favorites') {
      return {
        icon: <Heart className="w-8 h-8 text-[#cc0000]" />,
        title: "Generated from Your Favorites! ❤️",
        description: `Your AI-powered titles are ready! Analyzed ${videosAnalyzedCount} of your personally curated videos.`,
        color: "cc0000"
      };
    }
    return {
      icon: <Sparkles className="w-8 h-8 text-white" />,
      title: "Mission Accomplished! 🚀",
      description: `Your AI-powered titles are ready! Analyzed ${videosAnalyzedCount} viral outlier videos.`,
      color: "cc0000"
    };
  };

  const sourceInfo = getDataSourceInfo();

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-4">
      {/* Hero Section */}
      <div className="text-center relative">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-red-600/10 to-red-700/10 rounded-3xl blur-3xl"></div>
        <div className="relative bg-[#181818] backdrop-blur-sm rounded-3xl p-8 border border-[#cc0000]/20">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className={`w-16 h-16 bg-gradient-to-r ${dataSource === 'favorites' ? 'from-red-500 to-red-600' : 'from-red-600 to-red-700'} rounded-full flex items-center justify-center animate-pulse`}>
              {sourceInfo.icon}
            </div>
            <div>
              <h2 className="text-4xl font-bold text-white mb-2">{sourceInfo.title}</h2>
              <p className="text-[#aaaaaa] text-xl">
                {sourceInfo.description}
              </p>
            </div>
          </div>

          {/* Data Source Badge */}
          <div className="flex justify-center mb-4">
            <Badge className={`text-lg py-2 px-6 ${dataSource === 'favorites' 
              ? 'bg-[#cc0000]/20 text-[#cc0000] border-[#cc0000]/30' 
              : 'bg-[#cc0000]/20 text-[#cc0000] border-[#cc0000]/30'
            }`}>
              {dataSource === 'favorites' ? (
                <>
                  <Heart className="w-4 h-4 mr-2" />
                  Generated from Your Favorites
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Generated from Viral Outliers
                </>
              )}
            </Badge>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gradient-to-br from-[#cc0000]/20 to-[#aa0000]/20 rounded-xl p-4 border border-[#cc0000]/30">
              <div className="text-[#cc0000] text-sm font-medium">Titles Generated</div>
              <div className="text-white text-2xl font-bold">{titles.length}</div>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl p-4 border border-green-500/30">
              <div className="text-green-400 text-sm font-medium">Videos Analyzed</div>
              <div className="text-white text-2xl font-bold">{videosAnalyzedCount}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-4 border border-purple-500/30">
              <div className="text-purple-400 text-sm font-medium">Patterns Discovered</div>
              <div className="text-white text-2xl font-bold">{uniquePatterns.length}</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-xl p-4 border border-yellow-500/30">
              <div className="text-yellow-400 text-sm font-medium">AI Confidence</div>
              <div className="text-white text-2xl font-bold">{performanceScore}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-[#181818] border-[#272727]">
          <TabsTrigger value="titles" className="data-[state=active]:bg-[#cc0000] data-[state=active]:text-white">
            <Star className="w-4 h-4 mr-2" />
            Your Titles
          </TabsTrigger>
          <TabsTrigger value="analysis" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white">
            <Brain className="w-4 h-4 mr-2" />
            AI Analysis
          </TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
            <Database className="w-4 h-4 mr-2" />
            Reference Data
          </TabsTrigger>
        </TabsList>

        {/* Your Titles Tab */}
        <TabsContent value="titles" className="space-y-6">
          <Card className="bg-[#181818] border-[#272727] shadow-2xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                <Star className="w-7 h-7 text-yellow-400" />
                Your Optimized Titles ({titles.length})
                <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Ready to Use!</Badge>
              </CardTitle>
              <p className="text-[#aaaaaa] text-lg">
                Each title is crafted using proven patterns from {dataSource === 'favorites' ? `your ${videosAnalyzedCount} favorite videos` : `${videosAnalyzedCount} successful viral videos`}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {titles.map((titleData, index) => (
                <div
                  key={index}
                  className="group p-6 bg-[#0f0f0f] rounded-xl border border-[#404040] hover:border-[#cc0000] transition-all duration-300 cursor-pointer hover:bg-[#181818] hover:shadow-lg"
                  onClick={() => copyTitle(titleData.title)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge variant="secondary" className="text-sm font-bold">#{index + 1}</Badge>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Copy className="w-4 h-4 text-[#cc0000]" />
                          <span className="text-[#cc0000] text-sm font-medium">Click to copy</span>
                        </div>
                      </div>
                      <p className="text-white text-xl font-medium leading-relaxed group-hover:text-[#f1f1f1] transition-colors mb-4">
                        {titleData.title}
                      </p>
                      
                      {/* Title Analysis */}
                      {titleData.adaptedFrom && (
                        <div className="bg-[#212121] rounded-lg p-3 mb-3">
                          <div className="text-[#cc0000] text-sm font-medium mb-1">Adapted from successful video:</div>
                          <div className="text-[#aaaaaa] text-sm italic">"{titleData.adaptedFrom}"</div>
                        </div>
                      )}
                      
                      {/* Pattern Tags */}
                      {(titleData.patterns.length > 0 || titleData.statements.length > 0) && (
                        <div className="flex flex-wrap gap-2">
                          {titleData.patterns.map((pattern, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                              <Lightbulb className="w-3 h-3 mr-1" />
                              {pattern}
                            </Badge>
                          ))}
                          {titleData.statements.map((statement, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-green-500/20 text-green-300 border-green-500/30">
                              <Zap className="w-3 h-3 mr-1" />
                              {statement}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {titleData.authorityReplacement && (
                        <div className="mt-2 text-purple-300 text-sm">
                          <Users className="w-3 h-3 inline mr-1" />
                          Authority: {titleData.authorityReplacement}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pattern Analysis */}
            <Card className="glass-effect border-purple-500/30 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Brain className="w-6 h-6 text-purple-400" />
                  AI Pattern Recognition
                </CardTitle>
                <p className="text-purple-200">Discovered winning formulas from {videosAnalyzedCount} videos</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-purple-300 font-medium">Patterns Identified</span>
                    <Badge className="bg-purple-500/20 text-purple-300">{uniquePatterns.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {uniquePatterns.slice(0, 5).map((pattern, i) => (
                      <div key={i} className="bg-slate-800/30 rounded-lg p-2 text-white text-sm">
                        "{pattern}"
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-purple-300 font-medium">Power Statements</span>
                    <Badge className="bg-purple-500/20 text-purple-300">{uniqueStatements.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {uniqueStatements.slice(0, 5).map((statement, i) => (
                      <div key={i} className="bg-slate-800/30 rounded-lg p-2 text-white text-sm">
                        "{statement}"
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card className="glass-effect border-green-500/30 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-green-400" />
                  Success Metrics
                </CardTitle>
                <p className="text-green-200">Based on reference video performance</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-300 font-medium">AI Confidence Score</span>
                    <span className="text-white font-bold">{performanceScore}%</span>
                  </div>
                  <Progress value={performanceScore} className="h-3" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <div className="text-green-400 text-sm font-medium">Total Analyzed</div>
                    <div className="text-white text-lg font-bold">{videosAnalyzedCount}</div>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <div className="text-green-400 text-sm font-medium">Avg. Performance</div>
                    <div className="text-white text-lg font-bold">{formatNumber(avgViews)}</div>
                  </div>
                </div>

                {topVideo && (
                  <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-4 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-5 h-5 text-yellow-400" />
                      <span className="text-white font-medium">Top Performing Reference</span>
                    </div>
                    <div className="text-green-300 text-sm">{formatNumber(topVideo?.view_count || 0)} views</div>
                    <div className="text-blue-200 text-xs mt-1 line-clamp-2">{topVideo?.title}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reference Data Tab */}
        <TabsContent value="data" className="space-y-6">
          <Card className="glass-effect border-green-500/30 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Database className="w-6 h-6 text-green-400" />
                Reference Video Database ({referenceVideos.length} shown)
              </CardTitle>
              <p className="text-green-200">
                {dataSource === 'favorites' 
                  ? `Analyzed ${videosAnalyzedCount} of your personally curated favorite videos (showing top ${referenceVideos.length})`
                  : `Analyzed ${videosAnalyzedCount} high-performing viral videos (showing top ${referenceVideos.length})`
                }
              </p>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {referenceVideos.map((video, index) => (
                  <div
                    key={video.id || index}
                    className="p-3 sm:p-4 bg-slate-800/30 rounded-lg border border-green-500/20 hover:border-green-400 transition-all duration-300 cursor-pointer group flex flex-col"
                    onClick={() => window.open(video.youtube_url, '_blank')}
                  >
                    <div className="relative mb-3">
                      <div className="w-full aspect-video rounded-md overflow-hidden">
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-green-500/90 text-white text-xs font-bold">
                          #{index + 1}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-3 flex flex-col flex-1">
                      <h4 className="text-white font-medium text-sm leading-tight line-clamp-3 group-hover:text-green-100 flex-1">
                        {video.title}
                      </h4>
                      
                      {video.channel_name && (
                        <div className="text-xs text-green-300 truncate">
                          {video.channel_name}
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-2 text-xs mt-auto">
                        <div className="bg-slate-700/30 rounded p-2">
                          <div className="text-blue-400 flex items-center gap-1 mb-1">
                            <Eye className="w-3 h-3" />
                            Views
                          </div>
                          <div className="text-white font-bold">{formatNumber(video.view_count || 0)}</div>
                        </div>
                        <div className="bg-slate-700/30 rounded p-2">
                          <div className="text-purple-400 flex items-center gap-1 mb-1">
                            <Users className="w-3 h-3" />
                            Subs
                          </div>
                          <div className="text-white font-bold">{formatNumber(video.channel_subscribers || 0)}</div>
                        </div>
                      </div>
                      
                      {video.niche && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                            {video.niche}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 pt-6">
        <Button
          onClick={onGenerateMore}
          size="lg"
          className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-8 py-3 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <RefreshCw className="w-5 h-5 mr-2" />
          Generate More Titles
        </Button>
        <Button
          onClick={onStartOver}
          variant="outline"
          size="lg"
          className="border-blue-500/30 text-blue-400 hover:bg-blue-500/20 px-8 py-3 rounded-xl text-lg font-semibold"
        >
          <Home className="w-5 h-5 mr-2" />
          Start New Project
        </Button>
      </div>
    </div>
  );
};
