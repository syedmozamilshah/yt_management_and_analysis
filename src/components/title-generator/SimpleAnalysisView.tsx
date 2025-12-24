
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Edit3, Check, X, Wand2, Swords, UserCheck } from 'lucide-react';

interface ScriptAnalysis {
  mainTopic: string;
  mainAuthority: string;
  authorityVsAuthority: {
    authority1: string;
    authority2: string;
    relationship: string;
  } | null;
  contentType: string;
  niche: string;
}

interface SimpleAnalysisViewProps {
  analysis: ScriptAnalysis;
  onAnalysisUpdate: (analysis: ScriptAnalysis) => void;
  onGenerateTitles: () => void;
  isGenerating: boolean;
}

const relationshipTypes = [
  'athlete vs athlete',
  'athlete vs team', 
  'athlete vs organization',
  'president vs president',
  'country vs country',
  'company vs company',
  'brand vs brand',
  'team vs team',
  'celebrity vs celebrity',
  'expert vs expert',
  'other'
];

export const SimpleAnalysisView: React.FC<SimpleAnalysisViewProps> = ({
  analysis,
  onAnalysisUpdate,
  onGenerateTitles,
  isGenerating
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState(analysis);

  const handleSave = () => {
    onAnalysisUpdate(editedAnalysis);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedAnalysis(analysis);
    setIsEditing(false);
  };

  const toggleAuthorityVsMode = () => {
    if (editedAnalysis.authorityVsAuthority) {
      // Switch to single authority mode
      setEditedAnalysis(prev => ({
        ...prev,
        authorityVsAuthority: null
      }));
    } else {
      // Switch to vs authority mode
      setEditedAnalysis(prev => ({
        ...prev,
        authorityVsAuthority: {
          authority1: '',
          authority2: '',
          relationship: 'other'
        }
      }));
    }
  };

  const updateAuthorityVs = (field: 'authority1' | 'authority2' | 'relationship', value: string) => {
    setEditedAnalysis(prev => ({
      ...prev,
      authorityVsAuthority: prev.authorityVsAuthority ? {
        ...prev.authorityVsAuthority,
        [field]: value
      } : null
    }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="bg-[#181818] border-[#272727] shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-[#f1f1f1] flex items-center justify-center gap-3">
            <Brain className="w-8 h-8 text-[#cc0000]" />
            What I Found in Your Video
          </CardTitle>
          <p className="text-[#aaaaaa] text-lg">
            I analyzed your content - you can edit anything that doesn't look right!
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Main Topic */}
              <div className="space-y-3">
                <label className="text-[#cc0000] font-semibold text-sm uppercase tracking-wide">
                  📺 What's your video about?
                </label>
                {isEditing ? (
                  <Input
                    value={editedAnalysis.mainTopic}
                    onChange={(e) => setEditedAnalysis(prev => ({ ...prev, mainTopic: e.target.value }))}
                    className="bg-[#0f0f0f] border-[#3f3f3f] text-[#f1f1f1] text-lg p-4 rounded-xl focus:border-[#cc0000] focus:ring-[#cc0000]/20"
                    placeholder="e.g., Making chocolate chip cookies"
                  />
                ) : (
                  <div className="bg-[#272727] rounded-xl p-4 border border-[#3f3f3f]">
                    <div className="text-[#f1f1f1] text-lg">{analysis.mainTopic}</div>
                  </div>
                )}
              </div>

              {/* Content Type */}
              <div className="space-y-3">
                <label className="text-[#cc0000] font-semibold text-sm uppercase tracking-wide">
                  🎬 What type of content?
                </label>
                {isEditing ? (
                  <Input
                    value={editedAnalysis.contentType}
                    onChange={(e) => setEditedAnalysis(prev => ({ ...prev, contentType: e.target.value }))}
                    className="bg-[#0f0f0f] border-[#3f3f3f] text-[#f1f1f1] text-lg p-4 rounded-xl focus:border-[#cc0000] focus:ring-[#cc0000]/20"
                    placeholder="e.g., Tutorial, Review, Story"
                  />
                ) : (
                  <div className="bg-[#272727] rounded-xl p-4 border border-[#3f3f3f]">
                    <Badge variant="secondary" className="text-lg py-2 px-4 capitalize bg-[#cc0000]/20 text-[#cc0000] border-[#cc0000]/30">
                      {analysis.contentType}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Category */}
              <div className="space-y-3">
                <label className="text-[#cc0000] font-semibold text-sm uppercase tracking-wide">
                  📂 Video category
                </label>
                {isEditing ? (
                  <Input
                    value={editedAnalysis.niche}
                    onChange={(e) => setEditedAnalysis(prev => ({ ...prev, niche: e.target.value }))}
                    className="bg-[#0f0f0f] border-[#3f3f3f] text-[#f1f1f1] text-lg p-4 rounded-xl focus:border-[#cc0000] focus:ring-[#cc0000]/20"
                    placeholder="e.g., Cooking, Gaming, Education"
                  />
                ) : (
                  <div className="bg-[#272727] rounded-xl p-4 border border-[#3f3f3f]">
                    <Badge variant="outline" className="text-lg py-2 px-4 capitalize border-[#cc0000]/30 text-[#cc0000]">
                      {analysis.niche || 'General'}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Authority Section */}
            <div className="space-y-6">
              {/* Authority Mode Toggle */}
              {isEditing && (
                <div className="space-y-3">
                  <label className="text-[#cc0000] font-semibold text-sm uppercase tracking-wide">
                    👤 Authority Type
                  </label>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={!editedAnalysis.authorityVsAuthority ? 'default' : 'outline'}
                      onClick={() => !editedAnalysis.authorityVsAuthority || toggleAuthorityVsMode()}
                      className={`flex-1 ${!editedAnalysis.authorityVsAuthority 
                        ? 'bg-[#cc0000] text-white hover:bg-[#aa0000]' 
                        : 'bg-[#272727] border-[#cc0000]/30 text-[#cc0000] hover:bg-[#cc0000]/20'
                      } rounded-xl py-3 text-sm font-medium`}
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Single Person/Brand
                    </Button>
                    <Button
                      type="button"
                      variant={editedAnalysis.authorityVsAuthority ? 'default' : 'outline'}
                      onClick={() => editedAnalysis.authorityVsAuthority || toggleAuthorityVsMode()}
                      className={`flex-1 ${editedAnalysis.authorityVsAuthority 
                        ? 'bg-[#cc0000] text-white hover:bg-[#cc0000]/90' 
                        : 'bg-[#272727] border-[#cc0000]/30 text-[#cc0000] hover:bg-[#cc0000]/20'
                      } rounded-xl py-3 text-sm font-medium`}
                    >
                      <Swords className="w-4 h-4 mr-2" />
                      Versus Battle
                    </Button>
                  </div>
                </div>
              )}

              {/* Authority Content */}
              {!editedAnalysis.authorityVsAuthority ? (
                /* Single Authority Mode */
                <div className="space-y-3">
                  <label className="text-[#cc0000] font-semibold text-sm uppercase tracking-wide">
                    🌟 Main person or brand mentioned
                  </label>
                  {isEditing ? (
                    <Input
                      value={editedAnalysis.mainAuthority}
                      onChange={(e) => setEditedAnalysis(prev => ({ ...prev, mainAuthority: e.target.value }))}
                      className="bg-[#0f0f0f] border-[#3f3f3f] text-[#f1f1f1] text-lg p-4 rounded-xl focus:border-[#cc0000] focus:ring-[#cc0000]/20"
                      placeholder="e.g., Gordon Ramsay, Nike, Me"
                    />
                  ) : (
                    <div className="bg-[#272727] rounded-xl p-4 border border-[#3f3f3f]">
                      <div className="text-[#f1f1f1] text-lg">{analysis.mainAuthority || 'None detected'}</div>
                    </div>
                  )}
                </div>
              ) : (
                /* Authority vs Authority Mode */
                <div className="space-y-4">
                  <label className="text-[#cc0000] font-semibold text-sm uppercase tracking-wide">
                    ⚔️ Who's battling against who?
                  </label>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <Input
                          value={editedAnalysis.authorityVsAuthority?.authority1 || ''}
                          onChange={(e) => updateAuthorityVs('authority1', e.target.value)}
                          className="bg-[#0f0f0f] border-[#cc0000]/30 text-[#f1f1f1] text-lg p-4 rounded-xl pr-12 focus:border-[#cc0000] focus:ring-[#cc0000]/20"
                          placeholder="First fighter (e.g., Messi)"
                        />
                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#cc0000] font-bold">
                          1
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <div className="bg-[#cc0000]/20 text-[#cc0000] px-4 py-2 rounded-full text-sm font-bold">
                          VS
                        </div>
                      </div>
                      <div className="relative">
                        <Input
                          value={editedAnalysis.authorityVsAuthority?.authority2 || ''}
                          onChange={(e) => updateAuthorityVs('authority2', e.target.value)}
                          className="bg-[#0f0f0f] border-[#cc0000]/30 text-[#f1f1f1] text-lg p-4 rounded-xl pr-12 focus:border-[#cc0000] focus:ring-[#cc0000]/20"
                          placeholder="Second fighter (e.g., Ronaldo)"
                        />
                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#cc0000] font-bold">
                          2
                        </div>
                      </div>
                      <Select
                        value={editedAnalysis.authorityVsAuthority?.relationship || 'other'}
                        onValueChange={(value) => updateAuthorityVs('relationship', value)}
                      >
                        <SelectTrigger className="bg-[#0f0f0f] border-[#cc0000]/30 text-[#f1f1f1] rounded-xl focus:border-[#cc0000] focus:ring-[#cc0000]/20">
                          <SelectValue placeholder="What kind of battle is this?" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#272727] border-[#cc0000]/30">
                          {relationshipTypes.map(type => (
                            <SelectItem key={type} value={type} className="text-[#f1f1f1] hover:bg-[#cc0000]/20 capitalize">
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="bg-[#272727] rounded-xl p-4 border border-[#cc0000]/20">
                      {analysis.authorityVsAuthority ? (
                        <div className="space-y-2">
                          <div className="text-[#f1f1f1] text-lg flex items-center justify-center gap-2">
                            <span className="text-[#cc0000] font-semibold">{analysis.authorityVsAuthority.authority1}</span>
                            <span className="text-[#cc0000] font-bold">VS</span>
                            <span className="text-[#cc0000] font-semibold">{analysis.authorityVsAuthority.authority2}</span>
                          </div>
                          <div className="text-[#cc0000] text-sm text-center capitalize">
                            {analysis.authorityVsAuthority.relationship}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[#f1f1f1] text-lg">None detected</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 mt-8 pt-6 border-t border-[#3f3f3f]">
            {isEditing ? (
              <>
                <Button
                  onClick={handleSave}
                  className="bg-[#00d400] hover:bg-[#00d400]/90 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Save Changes
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="border-[#cc0000]/30 text-[#cc0000] hover:bg-[#cc0000]/20 px-8 py-4 rounded-xl text-lg font-semibold bg-[#272727]"
                >
                  <X className="w-5 h-5 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={onGenerateTitles}
                  disabled={isGenerating}
                  size="lg"
                  className="bg-[#cc0000] hover:bg-[#aa0000] text-white px-12 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
                      Creating Amazing Titles...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5 mr-3" />
                      Generate Amazing Titles ✨
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  className="border-[#cc0000]/30 text-[#cc0000] hover:bg-[#cc0000]/20 px-8 py-4 rounded-xl text-lg font-semibold bg-[#272727]"
                >
                  <Edit3 className="w-5 h-5 mr-2" />
                  Edit Details
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
