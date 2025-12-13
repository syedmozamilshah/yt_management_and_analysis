
export interface Video {
  id: string;
  title: string;
  youtube_url: string;
  video_id: string;
  thumbnail_url: string;
  created_at: string;
  channel_name?: string | null;
  channel_id?: string | null;
  channel_subscribers?: number | null;
  upload_date?: string | null;
  view_count?: number | null;
  is_favorite?: boolean;
  niche?: string | null;
}
