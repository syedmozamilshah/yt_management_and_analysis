
import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AddVideoSection from './sections/AddVideoSection';

const AdminAddVideo = () => {
  const queryClient = useQueryClient();

  const handleVideoAdded = () => {
    // Invalidate video queries to refresh the data
    queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
    queryClient.invalidateQueries({ queryKey: ['videos'] });
  };

  return <AddVideoSection onVideoAdded={handleVideoAdded} />;
};

export default AdminAddVideo;
