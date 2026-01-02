# WebSub (Real-time Competitor Tracking) Setup Guide

This guide explains how to set up and deploy the WebSub system for real-time YouTube competitor tracking.

## Overview

The WebSub system uses YouTube's PubSubHubbub hub to deliver real-time notifications when subscribed competitors upload new videos. It's designed to be:

- **Event-driven**: No unnecessary polling
- **Efficient**: Subscriptions paused for inactive users
- **Reliable**: Fallback RSS polling every 12 hours
- **Scalable**: Database-driven with proper indexing

## Prerequisites

1. **YouTube API Key** with access to:
   - YouTube Data API v3
   - Channels resource (for resolving @handles)

2. **Supabase Project** with:
   - PostgreSQL database
   - Edge Functions enabled
   - PgBoss or similar for scheduled tasks

3. **Deployment Platform**:
   - Vercel (recommended for Edge Functions)
   - Or self-hosted Node.js server

## Step 1: Set Environment Variables

Add these to your Supabase environment or `.env` file:

```bash
# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key_here

# Webhook configuration
WEBHOOK_BASE_URL=https://yt-management-and-analysis.vercel.app
# For dev: https://yt-management-and-analysis-git-dev-syed-mozamil-shahs-projects.vercel.app

# Supabase
SUPABASE_URL=https://baffhoalkllpeugluyon.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Step 2: Database Migrations

Run the migration to create the necessary tables:

```bash
supabase migration up
```

This creates:
- Extended `user_competitor_channels` with WebSub fields
- `user_competitor_videos` for storing videos from WebSub and polling
- `websub_subscriptions` for subscription lifecycle management
- Triggers for activity tracking

## Step 3: Deploy Edge Functions

Deploy each Supabase Edge Function:

```bash
# Deploy all functions
supabase functions deploy resolve-channel-id
supabase functions deploy subscribe-youtube-webhook
supabase functions deploy webhooks-youtube
supabase functions deploy renew-websub-subscriptions
supabase functions deploy poll-rss-feeds
```

Or deploy via Supabase CLI:

```bash
supabase functions deploy --project-ref baffhoalkllpeugluyon
```

### Function Details

#### 1. `resolve-channel-id`
Extracts YouTube channel ID from URLs or @handles.

**Input:**
```json
{
  "channel_input": "@channelname" | "youtube.com/@channel" | "UCxxxxxx"
}
```

**Output:**
```json
{
  "channel_id": "UCxxxxxx",
  "rss_feed_url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxx"
}
```

#### 2. `subscribe-youtube-webhook`
Initiates WebSub subscription with the YouTube Hub.

**Input:**
```json
{
  "channel_id": "UCxxxxxx",
  "user_id": "uuid"
}
```

**Output:**
```json
{
  "status": "success",
  "message": "WebSub subscription initiated",
  "expiresAt": "2026-01-07T12:00:00Z"
}
```

#### 3. `webhooks-youtube`
Webhook endpoint that receives video notifications from YouTube Hub.

**GET Request** (Hub Verification):
```
GET /webhooks-youtube?hub.challenge=CHALLENGE_STRING&hub.mode=subscribe
Response: CHALLENGE_STRING (raw text, status 200)
```

**POST Request** (Video Notification):
```
Content-Type: application/xml
[Atom XML feed with video entries]

Response: 200 OK
{
  "status": "success",
  "saved": 1,
  "duplicates": 0
}
```

#### 4. `renew-websub-subscriptions`
Background job that renews subscriptions before expiration.

**Schedule**: Once per day (via cron)

**Logic:**
1. Find subscriptions expiring in next 24 hours
2. Check if user is active (visited competitor route in last 72h)
3. For active users: Re-subscribe via WebSub
4. For inactive users: Skip (pause subscription)

**Monitoring:**
- `websub_subscriptions.renewal_status` shows result (active/failed/pending)
- `websub_subscriptions.last_renewal_error` contains error details

#### 5. `poll-rss-feeds`
Fallback polling mechanism for robustness.

**Schedule**: Every 12 hours (via cron)

**Logic:**
1. Fetch all RSS feeds for active users
2. Parse Atom XML entries
3. Detect new video_ids not in database
4. Insert missing videos with `source='rss_polling'`
5. Skip duplicates

## Step 4: Schedule Background Jobs

### Option A: Using Supabase Cron (PostgreSQL pg_cron)

```sql
-- Daily subscription renewal at 2 AM UTC
SELECT cron.schedule('renew-websub-subscriptions', '0 2 * * *', 
  'SELECT http_post(''https://your-functions-url/renew-websub-subscriptions'', ''{}''::json)');

-- RSS polling every 12 hours
SELECT cron.schedule('poll-rss-feeds', '0 */12 * * *',
  'SELECT http_post(''https://your-functions-url/poll-rss-feeds'', ''{}''::json)');
```

### Option B: Using External Scheduler (e.g., EasyCron)

1. Go to https://www.easycron.com
2. Create new cron jobs:

**Job 1: Subscription Renewal**
```
URL: https://your-functions-url/renew-websub-subscriptions
Method: POST
Schedule: 0 2 * * * (daily at 2 AM)
```

**Job 2: RSS Polling**
```
URL: https://your-functions-url/poll-rss-feeds
Method: POST
Schedule: 0 */12 * * * (every 12 hours)
```

### Option C: Node.js CronJob

If hosting on Node.js:

```typescript
import cron from 'node-cron';

// Daily renewal at 2 AM UTC
cron.schedule('0 2 * * *', async () => {
  const response = await fetch(
    'https://your-functions-url/renew-websub-subscriptions',
    { method: 'POST' }
  );
  console.log('Renewal job completed:', response.status);
});

// RSS polling every 12 hours
cron.schedule('0 */12 * * *', async () => {
  const response = await fetch(
    'https://your-functions-url/poll-rss-feeds',
    { method: 'POST' }
  );
  console.log('Polling job completed:', response.status);
});
```

## Step 5: Frontend Integration

The frontend is already integrated. Users can:

1. Go to **Competitors > Real-time Tracker**
2. Enter a YouTube channel URL or @handle
3. System automatically:
   - Resolves channel ID
   - Creates RSS feed URL
   - Initiates WebSub subscription
4. Videos appear in real-time or within 12 hours

## Step 6: Verify Setup

### 1. Test Channel Resolution
```bash
curl -X POST https://your-functions-url/resolve-channel-id \
  -H "Content-Type: application/json" \
  -d '{"channel_input":"@TechGuruDaily"}'
```

Expected response:
```json
{
  "channel_id": "UCxxxxxx",
  "rss_feed_url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxx"
}
```

### 2. Test Webhook Verification
```bash
curl "https://your-functions-url/webhooks-youtube?hub.mode=subscribe&hub.topic=https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxx&hub.challenge=test123"
```

Expected response: `test123` (raw text)

### 3. Check Database Records
```sql
-- View subscribed channels
SELECT * FROM user_competitor_channels WHERE webhook_subscribed = true;

-- View subscription details
SELECT * FROM websub_subscriptions WHERE renewal_status = 'active';

-- View received videos
SELECT * FROM user_competitor_videos ORDER BY published_at DESC;

-- Check renewal history
SELECT * FROM websub_subscriptions 
WHERE last_renewal_at > NOW() - INTERVAL '24 hours';
```

### 4. Monitor Subscription Status
```sql
-- Find failed subscriptions
SELECT * FROM websub_subscriptions 
WHERE renewal_status = 'failed';

-- Check renewal errors
SELECT user_id, channel_id, last_renewal_error 
FROM websub_subscriptions 
WHERE last_renewal_error IS NOT NULL;

-- Check inactive users
SELECT DISTINCT ws.user_id
FROM websub_subscriptions ws
LEFT JOIN auth.users u ON ws.user_id = u.id
WHERE u.last_competitor_route_opened < NOW() - INTERVAL '72 hours'
   OR u.last_competitor_route_opened IS NULL;
```

## Troubleshooting

### Issue: "WebSub subscription failed"

**Causes:**
1. Invalid YouTube API key
2. Channel doesn't exist
3. Handle format incorrect

**Solution:**
- Verify YouTube API key is active
- Test with direct channel ID (UC...)
- Check channel URL is correct

### Issue: Videos not appearing

**Causes:**
1. Webhook endpoint not accessible
2. WebSub hub hasn't sent verification
3. RSS polling hasn't run yet

**Solution:**
- Verify `WEBHOOK_BASE_URL` is correct
- Check Supabase function logs
- Wait for next 12-hour polling cycle
- Manually trigger `POST /poll-rss-feeds`

### Issue: Subscription renewal failing

**Causes:**
1. WebSub hub unreachable
2. User account issues
3. Database permission errors

**Solution:**
- Check `websub_subscriptions.last_renewal_error`
- Manually re-subscribe user
- Check database logs

### Issue: High number of failed renewals

**Causes:**
1. YouTube Hub rate limiting
2. Network connectivity issues
3. Expired API credentials

**Solution:**
- Check function logs for rate limit responses
- Implement exponential backoff in renewal function
- Rotate API keys if expired

## Performance Optimization

### Indexing

Already created in migrations:
```sql
CREATE INDEX idx_user_competitor_videos_user_id ON user_competitor_videos(user_id);
CREATE INDEX idx_user_competitor_videos_channel_id ON user_competitor_videos(channel_id);
CREATE INDEX idx_user_competitor_videos_published_at ON user_competitor_videos(published_at DESC);
CREATE INDEX idx_websub_subscriptions_expires_at ON websub_subscriptions(subscription_expires_at);
CREATE INDEX idx_websub_subscriptions_renewal_status ON websub_subscriptions(renewal_status);
```

### RLS Policies

All tables have Row Level Security enabled, so queries are automatically filtered by `user_id`.

### Caching

- Frontend: Auto-refresh every 30 seconds (configurable)
- Database: Proper indexing for fast queries
- No persistent cache - always fresh data

## Scaling Considerations

1. **High volume**: Use PgBoss for job queue management
2. **Many users**: Batch renewal jobs by user
3. **Large RSS feeds**: Paginate RSS parsing
4. **Rate limits**: Implement backoff and retry logic

## Security

1. ✅ All database tables have RLS enabled
2. ✅ Webhook endpoint validates hub.topic format
3. ✅ Service role key only used by backend functions
4. ✅ API keys stored in Supabase secrets
5. ✅ No sensitive data in logs

## References

- [PubSubHubbub (WebSub) Spec](https://www.w3.org/TR/websub/)
- [YouTube RSS Feeds](https://www.youtube.com/feeds)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [PubSubHubbub Hub List](https://pubsubhubbub.appspot.com/)

## Support

For issues or questions:
1. Check Supabase function logs
2. Review database tables for data consistency
3. Test endpoints manually with curl
4. Monitor webhook delivery via logs
