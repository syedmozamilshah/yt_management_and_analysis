
-- Create competitor_channels table
CREATE TABLE public.competitor_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_name TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  channel_subscribers INTEGER DEFAULT 0,
  total_videos INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.competitor_channels ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to view competitor channels
CREATE POLICY "Anyone can view competitor channels" 
  ON public.competitor_channels 
  FOR SELECT 
  USING (true);

-- Create policy to allow anyone to insert competitor channels
CREATE POLICY "Anyone can insert competitor channels" 
  ON public.competitor_channels 
  FOR INSERT 
  WITH CHECK (true);

-- Create policy to allow anyone to delete competitor channels
CREATE POLICY "Anyone can delete competitor channels" 
  ON public.competitor_channels 
  FOR DELETE 
  USING (true);

-- Create policy to allow anyone to update competitor channels
CREATE POLICY "Anyone can update competitor channels" 
  ON public.competitor_channels 
  FOR UPDATE 
  USING (true);
