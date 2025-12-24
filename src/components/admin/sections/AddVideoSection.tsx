
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import VideoForm from '../VideoForm';

interface AddVideoSectionProps {
  onVideoAdded: () => void;
}

const AddVideoSection: React.FC<AddVideoSectionProps> = ({ onVideoAdded }) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-[#cc0000] rounded-full flex items-center justify-center mx-auto mb-4">
          <Plus className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-[#f1f1f1] mb-2">Add a New Competitor Video 📹</h2>
        <p className="text-[#aaaaaa] text-lg">
          Paste any YouTube video URL and we'll save it to your collection
        </p>
      </div>

      <Card className="bg-[#181818] border-[#272727] max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-[#f1f1f1] text-xl">Add Competitor Video</CardTitle>
          <p className="text-[#aaaaaa] text-sm">
            Just paste a YouTube link and we'll do the rest! ✨
          </p>
        </CardHeader>
        <CardContent>
          <VideoForm onVideoAdded={onVideoAdded} />
        </CardContent>
      </Card>

      <div className="max-w-2xl mx-auto">
        <Card className="bg-[#181818] border-[#272727]">
          <CardContent className="p-4">
            <h3 className="text-[#f1f1f1] font-semibold mb-2">💡 How it works:</h3>
            <ul className="text-[#aaaaaa] text-sm space-y-1">
              <li>• Copy any YouTube video URL</li>
              <li>• Paste it in the form above</li>
              <li>• Choose a category for your video</li>
              <li>• Click "Add Competitor Video" and you're done!</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddVideoSection;
