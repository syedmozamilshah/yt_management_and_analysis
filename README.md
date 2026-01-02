# YouTube Management & Analysis Platform

A comprehensive YouTube content management and analysis platform built with React, TypeScript, and Supabase. This tool helps content creators manage their video library, analyze competitors, generate SEO-optimized content, and create AI-powered scripts.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)

## 🚀 Features

### 📺 Video Management
- **Video Library**: Organize and manage your YouTube video collection
- **Video Details Modal**: View detailed analytics and information for each video
- **Favorites System**: Mark and manage your favorite videos
- **Filter & Search**: Advanced filtering by date, views, and other metrics

### 📊 Analytics & Insights
- **Viewboard Dashboard**: Comprehensive analytics dashboard for channel performance
- **Channel Statistics**: Track subscriber counts, view trends, and engagement metrics
- **Database View**: Structured view of all your video data

### 🔍 Competitor Analysis
- **Competitor Tracking**: Add and monitor competitor YouTube channels
- **Video Discovery**: Automatically discover and track competitor videos
- **Performance Comparison**: Compare your content with competitors

### 🛠️ AI-Powered Tools

#### Script Generator
- **Multi-step Workflow**: Article → Research Outline → Full Script
- **AI-Powered Research**: Uses Perplexity AI to research and create detailed outlines
- **Script Generation**: Claude AI generates complete YouTube scripts from outlines
- **Word Usage Tracking**: Monthly word limit tracking (40,000 words/month)
- **Edit & Regenerate**: Edit outlines before generating final scripts

#### SEO Generator
- **Title Generation**: Generate 5 optimized YouTube titles
- **Description Writing**: AI-powered video description generation
- **Tag Suggestions**: Relevant tags for better discoverability
- **OpenAI Powered**: Uses GPT for high-quality SEO content

#### Title Generator
- **Multiple Title Variants**: Generate various title options
- **Click-worthy Titles**: Optimized for engagement and CTR

### 👤 User Management
- **Authentication**: Secure user authentication via Supabase
- **User-specific Data**: Each user has their own video library and data
- **Admin Dashboard**: Admin-only features for managing all users' data

### 📈 Admin Features
- **Admin Dashboard**: Overview of platform usage and statistics
- **All Users View**: Toggle between viewing own data vs all users' data
- **Analytics Tables**: Track tool usage and platform metrics

## 🏗️ Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality UI components built on Radix UI
- **React Router** - Client-side routing
- **TanStack Query** - Server state management
- **Recharts** - Data visualization charts

### Backend
- **Supabase** - Backend as a Service
  - PostgreSQL Database
  - Row Level Security (RLS)
  - Edge Functions (Deno)
  - Authentication
  - Real-time subscriptions

### AI & External Services
- **n8n Webhooks** - Workflow automation for script generation
- **Perplexity AI** - Web research and outline generation
- **Claude AI** - Script generation
- **OpenAI** - SEO content generation
- **YouTube Data API** - Video and channel data

## 📁 Project Structure

```
├── public/                  # Static assets
├── src/
│   ├── components/          # React components
│   │   ├── admin/           # Admin-specific components
│   │   ├── competitors/     # Competitor analysis components
│   │   ├── home/            # Home page components
│   │   ├── title-generator/ # Title generation components
│   │   ├── tools/           # AI tools (Script & SEO generators)
│   │   └── ui/              # shadcn/ui components
│   ├── contexts/            # React context providers
│   ├── hooks/               # Custom React hooks
│   ├── integrations/        # Third-party integrations (Supabase)
│   ├── lib/                 # Utility libraries
│   ├── pages/               # Page components
│   ├── services/            # API services
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
├── supabase/
│   ├── functions/           # Supabase Edge Functions
│   │   ├── analyze-channel/
│   │   ├── analyze-competitor-channel/
│   │   ├── analyze-script/
│   │   ├── auto-discover-videos/
│   │   ├── generate-seo/
│   │   ├── generate-titles/
│   │   ├── get-channel-videos/
│   │   ├── get-channel-viewboard-stats/
│   │   ├── get-fresh-channel-stats/
│   │   ├── get-youtube-video/
│   │   ├── refresh-viewboard-cache/
│   │   ├── tool-usage/
│   │   ├── update-all-channels/
│   │   └── update-competitor-channels/
│   └── migrations/          # Database migrations
└── package.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm, yarn, or bun package manager
- Supabase account
- API keys for:
  - OpenAI (for SEO generation)
  - YouTube Data API (for video/channel data)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/syedmozamilshah/yt_management_and_analysis.git
   cd yt_management_and_analysis
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   bun install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_PROJECT_ID=your_supabase_project_id
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   VITE_SUPABASE_URL=https://your-project.supabase.co
   ```

4. **Set up Supabase**
   
   - Create a new Supabase project
   - Run the migrations in `supabase/migrations/` folder
   - Deploy Edge Functions from `supabase/functions/`
   - Set up Edge Function secrets:
     ```
     OPENAI_API_KEY=your_openai_api_key
     YOUTUBE_API_KEY=your_youtube_api_key
     ```

5. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   bun dev
   ```

6. **Open your browser**
   
   Navigate to `http://localhost:5173`

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run build:dev` | Build for development |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## 🗄️ Database Setup

### Required Migrations

Run these migrations in order:

1. `20251209000000_user_specific_tables.sql` - User-specific data tables
2. `20251211_admin_view_all_data.sql` - Admin data viewing permissions
3. `20251212_admin_analytics_tables.sql` - Analytics tracking tables
4. `20251212_tools_usage_tables.sql` - Script/SEO tool usage tracking
5. `20251212_competitor_cron_job.sql` - Competitor channel automation

### Setting up Cron Jobs

To enable automatic competitor channel updates every 12 hours:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cron job
SELECT cron.schedule(
  'update-competitor-channels-every-12-hours',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/update-competitor-channels',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## 🔧 Configuration

### n8n Webhook URLs

The Script Generator uses n8n webhooks for AI processing:

| Webhook | Purpose |
|---------|---------|
| `ANALYZE_WEBHOOK_URL` | Research & outline generation (Perplexity AI) |
| `GENERATE_WEBHOOK_URL` | Script generation (Claude AI) |

These are configured in `src/components/tools/ScriptGenerator.tsx`.

### Word Limits

Default monthly word limit is 40,000 words per user. This can be configured in `src/pages/Tools.tsx`.

## 🔐 Authentication

The app uses Supabase Authentication with:
- Email/Password authentication
- Protected routes for authenticated users
- Admin-only routes and features
- Row Level Security (RLS) for data isolation

## 📱 Responsive Design

The application is fully responsive with:
- Mobile-first design approach
- Collapsible sidebar for mobile devices
- Touch-friendly interactions
- Adaptive layouts for all screen sizes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 🆘 Support

For support, please contact the repository owner or open an issue in the GitHub repository.

---

Built with ❤️ using React, TypeScript, and Supabase
