
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Edit3, Check, X, Swords, UserCheck } from 'lucide-react';

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

interface EditableScriptAnalysisProps {
  analysis: ScriptAnalysis;
  onSave: (updatedAnalysis: ScriptAnalysis) => void;
  onEdit: () => void;
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

export const EditableScriptAnalysis: React.FC<EditableScriptAnalysisProps> = ({
  analysis,
  onSave,
  onEdit
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState<ScriptAnalysis>(analysis);

  const handleSave = () => {
    onSave(editedAnalysis);
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
    <Card className="glass-effect border-blue-500/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-400" />
            Script Analysis
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  className="text-green-400 hover:text-green-300"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(true);
                  onEdit();
                }}
                className="text-blue-400 hover:text-blue-300"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Main Topic */}
            <div className="space-y-2">
              <label className="text-blue-400 text-sm font-medium">Main Topic</label>
              {isEditing ? (
                <Input
                  value={editedAnalysis.mainTopic}
                  onChange={(e) => setEditedAnalysis(prev => ({ ...prev, mainTopic: e.target.value }))}
                  className="bg-slate-800/50 border-blue-500/30 text-white"
                />
              ) : (
                <div className="bg-slate-800/30 rounded-lg p-3 border border-blue-500/20">
                  <div className="text-white text-sm">{analysis.mainTopic}</div>
                </div>
              )}
            </div>

            {/* Content Type */}
            <div className="space-y-2">
              <label className="text-blue-400 text-sm font-medium">Content Type</label>
              {isEditing ? (
                <Input
                  value={editedAnalysis.contentType}
                  onChange={(e) => setEditedAnalysis(prev => ({ ...prev, contentType: e.target.value }))}
                  className="bg-slate-800/50 border-blue-500/30 text-white"
                />
              ) : (
                <div className="bg-slate-800/30 rounded-lg p-3 border border-blue-500/20">
                  <div className="text-white text-sm capitalize">{analysis.contentType}</div>
                </div>
              )}
            </div>

            {/* Niche */}
            <div className="space-y-2">
              <label className="text-blue-400 text-sm font-medium">Niche</label>
              {isEditing ? (
                <Input
                  value={editedAnalysis.niche}
                  onChange={(e) => setEditedAnalysis(prev => ({ ...prev, niche: e.target.value }))}
                  className="bg-slate-800/50 border-blue-500/30 text-white"
                />
              ) : (
                <div className="bg-slate-800/30 rounded-lg p-3 border border-blue-500/20">
                  <div className="text-white text-sm capitalize">{analysis.niche || 'General'}</div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Authority Mode Toggle */}
            {isEditing && (
              <div className="space-y-2">
                <label className="text-blue-400 text-sm font-medium">Authority Type</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={!editedAnalysis.authorityVsAuthority ? 'default' : 'outline'}
                    onClick={() => !editedAnalysis.authorityVsAuthority || toggleAuthorityVsMode()}
                    className={`${!editedAnalysis.authorityVsAuthority 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-slate-800/50 border-blue-500/30 text-blue-300 hover:bg-blue-500/20'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Single Authority
                  </Button>
                  <Button
                    type="button"
                    variant={editedAnalysis.authorityVsAuthority ? 'default' : 'outline'}
                    onClick={() => editedAnalysis.authorityVsAuthority || toggleAuthorityVsMode()}
                    className={`${editedAnalysis.authorityVsAuthority 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-slate-800/50 border-blue-500/30 text-blue-300 hover:bg-blue-500/20'
                    }`}
                  >
                    <Swords className="w-4 h-4 mr-2" />
                    Authority vs Authority
                  </Button>
                </div>
              </div>
            )}

            {/* Main Authority or Authority vs Authority */}
            {!editedAnalysis.authorityVsAuthority ? (
              <div className="space-y-2">
                <label className="text-blue-400 text-sm font-medium">Main Authority</label>
                {isEditing ? (
                  <Input
                    value={editedAnalysis.mainAuthority}
                    onChange={(e) => setEditedAnalysis(prev => ({ ...prev, mainAuthority: e.target.value }))}
                    className="bg-slate-800/50 border-blue-500/30 text-white"
                    placeholder="e.g., Elon Musk, Apple, Joe Rogan"
                  />
                ) : (
                  <div className="bg-slate-800/30 rounded-lg p-3 border border-blue-500/20">
                    <div className="text-white text-sm">{analysis.mainAuthority || 'None detected'}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-blue-400 text-sm font-medium">Authority vs Authority</label>
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={editedAnalysis.authorityVsAuthority?.authority1 || ''}
                        onChange={(e) => updateAuthorityVs('authority1', e.target.value)}
                        className="bg-slate-800/50 border-blue-500/30 text-white"
                        placeholder="First authority"
                      />
                      <Input
                        value={editedAnalysis.authorityVsAuthority?.authority2 || ''}
                        onChange={(e) => updateAuthorityVs('authority2', e.target.value)}
                        className="bg-slate-800/50 border-blue-500/30 text-white"
                        placeholder="Second authority"
                      />
                      <Select
                        value={editedAnalysis.authorityVsAuthority?.relationship || 'other'}
                        onValueChange={(value) => updateAuthorityVs('relationship', value)}
                      >
                        <SelectTrigger className="bg-slate-800/50 border-blue-500/30 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-blue-500/30">
                          {relationshipTypes.map(type => (
                            <SelectItem key={type} value={type} className="text-white hover:bg-blue-500/20">
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="bg-slate-800/30 rounded-lg p-3 border border-blue-500/20">
                      {analysis.authorityVsAuthority ? (
                        <div className="space-y-1">
                          <div className="text-white text-sm">
                            <span className="text-blue-300">{analysis.authorityVsAuthority.authority1}</span>
                            {' vs '}
                            <span className="text-blue-300">{analysis.authorityVsAuthority.authority2}</span>
                          </div>
                          <div className="text-blue-400 text-xs capitalize">
                            {analysis.authorityVsAuthority.relationship}
                          </div>
                        </div>
                      ) : (
                        <div className="text-white text-sm">None detected</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
