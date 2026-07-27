# 🎬 BlowMe AI — YouTube Management & Analysis Platform

<div align="center">

![BlowMe AI](https://img.shields.io/badge/BlowMe_AI-Platform-cc0000?style=for-the-badge&labelColor=0f0f0f)
![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

**An all-in-one command center for YouTube content creators — track channels, spy on competitors, generate AI scripts, and dominate your niche.**

</div>

---

## 🗺️ Platform Overview — Mind Map

```mermaid
mindmap
  root((BlowMe AI))
    📺 Video Dashboard
      Ideation Tab
        Personal competitor tracking
        RSS-based video discovery
        Real-time new video alerts
      USA Tab
        Admin-curated US channels
        Global content for all users
      Spanish Tab
        Admin-curated Spanish channels
        Multi-language content
      Favorites
        Bookmark key videos
        Quick access collection
    🤖 AI Tools
      Script Generator
        Article research via Perplexity AI
        Outline creation
        Full script via Claude AI
        40k word monthly limit
      SEO Generator
        5 optimized titles
        Video description writing
        Tag suggestions
        OpenAI powered
      Title Generator
        Click-worthy title variants
        CTR-optimized options
      Competitor Finder
        Discover similar channels
        Deep channel analysis
        Export results
    📡 Channel Tracking
      Add any YouTube channel
      RSS feed polling
      YouTube WebSub webhooks
      Auto-sync new uploads
      Multi-tab organization
    👑 Admin Dashboard
      Video Management
        All users videos
        Edit & delete videos
        Niche management
      User Management
        Approve/block users
        View user activity
        Status management
      Admin Stats
        Platform-wide analytics
        AI tool usage metrics
        User growth tracking
      Channel Management
        Global channel distribution
        All-users channel sync
    🔐 Authentication
      Email OTP login
      Admin email/password
      Role-based access
      Pending approval flow
      Blocked account handling
```

---

## 🎯 What Is BlowMe AI?

**BlowMe AI** is a private, invite-only YouTube intelligence platform designed for professional content creators and their teams. It centralizes everything a YouTube creator needs:

- 🔍 **Spy on competitors** — track any YouTube channel's uploads in real-time via RSS feeds and YouTube WebSub webhooks
- 📊 **Organize video intelligence** — curate videos into Ideation, USA, and Spanish buckets for your content team
- 🤖 **Generate AI content** — go from a topic idea to a full production-ready script in minutes
- 📈 **Track your metrics** — see what's performing across channels and niches
- 👥 **Manage your team** — admin controls for approving users, distributing content, and monitoring tool usage

---

## 📸 Platform Gallery

Explore the BlowMe AI platform through these screenshots:

<details>
<summary><b>Click to view gallery</b></summary>

### Authentication
<img src="./Output/Login Page.png" alt="Login Page" width="800" />
<br />
<img src="./Output/Admin Login page.png" alt="Admin Login" width="800" />

### Dashboards
<img src="./Output/2.png" alt="Main View" width="800" />
<br />
<img src="./Output/Admin Dashboard.png" alt="Admin Dashboard" width="800" />
<br />
<img src="./Output/Setting Sidebar.png" alt="Settings Sidebar" width="800" />
<br />
<img src="./Output/Admin User management admin can approve disapprove and block users.png" alt="Admin User Management" width="800" />

### Features & Tools
<img src="./Output/Adding New channel and selecting timeperiod to fetch videos.png" alt="Adding New Channel" width="800" />
<br />
<img src="./Output/Competitor Finder.png" alt="Competitor Finder" width="800" />
<br />
<img src="./Output/Script Generator.png" alt="Script Generator" width="800" />
<br />
<img src="./Output/Seo Generator.png" alt="SEO Generator" width="800" />
<br />
<img src="./Output/Title Generator.png" alt="Title Generator" width="800" />
<br />
<img src="./Output/Screenshot 2026-07-27 224842.png" alt="Ideation Analysis" width="800" />

</details>

---

## 👥 User Roles & Access

```mermaid
flowchart TD
    A[🌐 Visitor] -->|Email OTP| B[Registered User]
    A -->|Admin Email + Password| C[Admin]

    B --> D{Account Status}
    D -->|pending| E[⏳ Waiting for Approval]
    D -->|approved| F[✅ Full Access]
    D -->|blocked| G[🚫 Access Denied]

    F --> H[Ideation Tab<br/>Personal channel tracking]
    F --> I[USA Tab<br/>Admin curated content]
    F --> J[Spanish Tab<br/>Admin curated content]
    F --> K[AI Tools<br/>Script / SEO / Title / Competitor]
    F --> L[Favorites<br/>Bookmarked videos]

    C --> M[All User Features]
    C --> N[Admin Dashboard]
    N --> O[User Management<br/>Approve / Block / View]
    N --> P[Video Management<br/>All users videos]
    N --> Q[Channel Management<br/>Global channel sync]
    N --> R[Admin Stats<br/>Platform analytics]
    N --> S[Data View Toggle<br/>All Data ↔ My Data]
```

---

## 📺 Main Dashboard — Video Tabs

The main dashboard has three content tabs, each serving a distinct purpose:

```mermaid
flowchart LR
    subgraph TABS["Main Dashboard Tabs"]
        direction TB
        A["💡 Ideation\n──────────\nPersonal competitor\nchannel tracking.\nEach user tracks\ntheir own channels\nvia RSS feeds."]
        B["🇺🇸 USA\n──────────\nAdmin-curated content\nfor all users.\nUS-focused YouTube\nchannels & videos."]
        C["🇪🇸 Spanish\n──────────\nAdmin-curated content\nfor all users.\nSpanish-language\nYouTube channels."]
    end

    subgraph FEATURES["Shared Features on All Tabs"]
        direction TB
        D[🔍 Advanced Filters\nDate / Views / Subscribers / Niche]
        E[✅ Multi-select Mode\nBulk delete videos]
        F[⭐ Favorites Toggle\nBookmark any video]
        G[📋 Video Detail Modal\nFull metadata view]
        H[⚙️ Tracked Channels Drawer\nManage tracked channels\n& AI prompt settings]
    end
```

---

## 📡 Channel Tracking System

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant APP as 🖥️ App
    participant FUNC as ⚡ Edge Functions
    participant YT as 📺 YouTube
    participant DB as 🗄️ Database

    U->>APP: Add YouTube Channel URL
    APP->>FUNC: analyze-channel(url, days)
    FUNC->>YT: Resolve handle → Channel ID
    FUNC->>YT: Fetch channel info (name, subs, thumbnail)
    FUNC->>FUNC: Parse RSS feed (free, no quota)
    FUNC-->>APP: Channel data + recent videos
    APP-->>U: Show analysis dialog

    U->>APP: Confirm → Add to tracking
    APP->>DB: Save to tracked_channels
    APP->>FUNC: fetch-channel-videos (persist to DB)
    DB->>DB: auto_sync trigger → user_videos
    APP->>FUNC: subscribe-youtube-webhook
    FUNC->>YT: WebSub subscription
    YT-->>FUNC: Real-time new video notifications

    Note over APP,DB: Background: poll-rss-feeds runs every 90s<br/>New videos auto-appear in the tab
```

---

## 🤖 AI Tools Suite

```mermaid
flowchart TD
    subgraph TOOLS["🛠️ AI Tools"]

        subgraph SCRIPT["📝 Script Generator"]
            S1[Enter Topic / Article URL] --> S2[AI Analyzes via Perplexity]
            S2 --> S3[Research Outline Created]
            S3 --> S4{User Reviews Outline}
            S4 -->|Edit if needed| S3
            S4 -->|Approve| S5[Claude AI Generates Full Script]
            S5 --> S6[Edit, Copy & Save Script]
        end

        subgraph SEO["🔖 SEO Generator"]
            E1[Enter Topic + Keywords] --> E2[OpenAI generates 5 Titles]
            E2 --> E3[Video Description Generated]
            E3 --> E4[Tag Suggestions Provided]
            E4 --> E5[Copy & Use in YouTube Studio]
        end

        subgraph TITLE["🔤 Title Generator"]
            T1[Enter Video Concept] --> T2[Multiple Title Variants]
            T2 --> T3[AI Chat to Refine Titles]
            T3 --> T4[Copy Best Title]
        end

        subgraph COMP["🔍 Competitor Finder"]
            C1[Enter a Channel URL] --> C2[Deep Channel Analysis]
            C2 --> C3[Find Similar Channels]
            C3 --> C4[View Their Stats & Content]
            C4 --> C5[Save Analysis to History]
        end
    end

    MONTHLY["📊 40,000 Word\nMonthly Limit\nTracked per user"] -.-> SCRIPT
    MONTHLY -.-> SEO
```

---

## 👑 Admin Dashboard

```mermaid
flowchart TD
    ADMIN["👑 Admin Login\nadmin@blowmeai.com"]

    ADMIN --> TOGGLE["🔄 Data View Toggle\nAll Data ↔ My Data"]

    TOGGLE --> VM["📹 Video Management\n─────────────────\n• View all users' videos\n• Edit video metadata\n• Delete videos\n• Filter by user/niche"]

    TOGGLE --> UM["👥 User Management\n─────────────────\n• See all registered users\n• Approve pending accounts\n• Block/unblock users\n• Monitor last activity"]

    TOGGLE --> CM["📡 Channel Management\n─────────────────────\n• View all tracked channels\n• Add global channels\n• Sync to all users\n• Delete channels"]

    TOGGLE --> NICHES["🏷️ Proven Niches\n──────────────\n• Manage niche taxonomy\n• Add/edit/delete niches\n• Applied globally to videos"]

    TOGGLE --> STATS["📊 Admin Stats\n──────────────\n• Total user count\n• New users (7d / 30d)\n• Active users tracking\n• AI tool usage breakdown\n• Script / SEO / Title usage\n• Words consumed per tool"]

    TOGGLE --> SIDEBAR["📱 Sidebar Sections\n(AI Tools, Ideation,\nUSA, Spanish tabs\nwith All Data view)"]
```

---

## 🔐 Authentication Flow

```mermaid
flowchart TD
    A[🌐 User visits app] --> B{Already logged in?}
    B -->|Yes, Admin| C[Redirect → Main Dashboard]
    B -->|Yes, Approved User| D[Redirect → Main Dashboard]
    B -->|Yes, Pending| E[Redirect → Pending Approval Page]
    B -->|Yes, Blocked| F[Redirect → Blocked Page]
    B -->|No| G[Auth Page]

    G --> H{Login Method}
    H -->|Regular User| I[Enter Email → Receive OTP Code]
    I --> J[Enter 6-digit OTP]
    J --> K{Account exists?}
    K -->|New User| L[Account Created → Status: Pending]
    K -->|Existing| M[Login → Check Status]
    L --> E
    M --> D

    H -->|Admin| N[/admin route\nEmail + Password]
    N --> O{Is admin email?}
    O -->|Yes| C
    O -->|No| P[Access Denied → Sign Out]
```

---

## 🔄 Real-Time Video Sync Architecture

```mermaid
flowchart LR
    subgraph SOURCES["📥 Video Sources"]
        RSS["RSS Feeds\n(Free, no quota)"]
        WEBSUB["YouTube WebSub\n(Real-time webhooks)"]
        MANUAL["Manual Add\n(User/Admin)"]
    end

    subgraph PIPELINE["⚙️ Processing Pipeline"]
        TC["tracked_channels\ntable"]
        TV["tracked_videos\ntable"]
        UV["user_videos\ntable"]
    end

    subgraph DELIVERY["📤 Delivery"]
        IDEATION["💡 Ideation Tab\n(per user)"]
        USA["🇺🇸 USA Tab\n(all users)"]
        SPANISH["🇪🇸 Spanish Tab\n(all users)"]
    end

    RSS --> TV
    WEBSUB --> TV
    MANUAL --> UV
    TV -->|auto_sync trigger| UV
    TC -->|poll every 90s| RSS
    UV --> IDEATION
    UV --> USA
    UV --> SPANISH
```

---

## 🏗️ Technology Stack

```mermaid
mindmap
  root((Tech Stack))
    Frontend
      React 18
        Hooks & Context
        React Router v6
        TanStack Query v5
      TypeScript
        Full type safety
        Supabase typed client
      Vite
        Fast HMR dev server
        Optimized builds
      UI Layer
        Tailwind CSS
        shadcn/ui components
        Radix UI primitives
        Recharts for graphs
    Backend
      Supabase
        PostgreSQL database
        Row Level Security
        Real-time subscriptions
        Auth OTP + Password
      Edge Functions
        Deno runtime
        25+ serverless functions
        YouTube API integration
        RSS parsing
    AI Services
      Perplexity AI
        Web research
        Outline generation
      Claude AI
        Script writing
        Long-form content
      OpenAI GPT
        SEO generation
        Title writing
    External APIs
      YouTube Data API
        Channel resolution
        Video metadata
      YouTube WebSub
        Real-time notifications
        New upload detection
      ScrapingBee API
        Web scraping
      SearchAPI
        Search results
```

---

## 📊 Feature Matrix

| Feature | Regular User | Admin (My Data) | Admin (All Data) |
|---|:---:|:---:|:---:|
| View Ideation Tab | ✅ Own videos | ✅ Own videos | ✅ All users' videos |
| View USA Tab | ✅ View only | ✅ View + Add | ✅ View + Add for all |
| View Spanish Tab | ✅ View only | ✅ View + Add | ✅ View + Add for all |
| Add channels (Ideation) | ✅ | ✅ | ❌ (viewing all) |
| Script Generator | ✅ | ✅ | ✅ |
| SEO Generator | ✅ | ✅ | ✅ |
| Title Generator | ✅ | ✅ | ✅ |
| Competitor Finder | ✅ | ✅ | ✅ |
| Favorites | ✅ Own | ✅ Own | ✅ All users' |
| User Management | ❌ | ✅ | ✅ |
| Admin Stats | ❌ | ✅ | ✅ |
| Delete any video | ❌ | ✅ Own | ✅ Any user's |
| Manage niches globally | ❌ | ✅ | ✅ |

---

## ⚡ Supabase Edge Functions

```mermaid
mindmap
  root((Edge Functions))
    Channel Operations
      analyze-channel
        Resolve YouTube URL to channel ID
        Fetch RSS feed for recent videos
      fetch-channel-videos
        RSS-based video ingestion
        Insert to tracked_videos
      get-channel-videos
        Historical video fetch
      resolve-channel-id
        Handle → Channel ID lookup
    Video Operations
      get-youtube-video
        Single video metadata
      get-video-stats
        View counts & metrics
      update-view-counts-batch
        Batch view count refresh
      auto-discover-videos
        Automatic new video detection
      update-user-videos
        Sync user video data
    Competitor Tools
      analyze-competitor-channel
        Deep channel analysis
        Similar channel discovery
      update-competitor-channels
        Background refresh of competitors
    AI Tools
      analyze-script
        n8n webhook for script generation
      generate-seo
        OpenAI SEO content generation
      generate-titles
        AI title variant generation
      get-transcript
        YouTube transcript extraction
    RSS & Webhooks
      poll-rss-feeds
        Periodic RSS polling for all users
      webhooks-youtube
        Receive YouTube WebSub notifications
      subscribe-youtube-webhook
        Subscribe to YouTube push notifications
      renew-websub-subscriptions
        Keep webhook subscriptions alive
    Analytics
      tool-usage
        Track AI tool consumption
      get-channel-viewboard-stats
        Channel performance metrics
      get-fresh-channel-stats
        Live channel statistics
      refresh-viewboard-cache
        Cache management
```

---

## 🗄️ Data Model Overview

```mermaid
erDiagram
    USERS {
        uuid id PK
        string email
        string user_status
    }

    TRACKED_CHANNELS {
        uuid id PK
        uuid user_id FK
        string channel_id
        string channel_name
        string channel_handle
        string rss_feed_url
        boolean webhook_subscribed
        string tab_type
        boolean is_active
    }

    TRACKED_VIDEOS {
        uuid id PK
        string video_id
        string channel_id FK
        string title
        string thumbnail_url
        timestamp published_at
        integer view_count
        string source
    }

    USER_VIDEOS {
        uuid id PK
        uuid user_id FK
        string video_id
        string title
        string channel_name
        integer channel_subscribers
        integer view_count
        string niche
        boolean is_favorite
        string tab_type
        date upload_date
    }

    PROFILES {
        uuid id PK
        string user_status
        timestamp created_at
    }

    ADMIN_GLOBAL_NICHES {
        uuid id PK
        string niche
        boolean is_active
    }

    USERS ||--o{ TRACKED_CHANNELS : "tracks"
    USERS ||--o{ USER_VIDEOS : "has"
    USERS ||--|| PROFILES : "has"
    TRACKED_CHANNELS ||--o{ TRACKED_VIDEOS : "generates"
    TRACKED_VIDEOS ||--o{ USER_VIDEOS : "syncs to"
```

---

## 🚦 System Status & Background Jobs

| Job | Trigger | Frequency | Purpose |
|---|---|---|---|
| RSS Poll | User on Ideation page | Every 90 seconds | Check tracked channels for new videos |
| Video Sync | On page load | Once per session | Sync missed videos to user's library |
| Metadata Refresh | On page load | Once per session | Fix timestamps, niches, view counts |
| Real-time Insert | WebSub notification | Instant | New uploads appear immediately |
| WebSub Renewal | Cron job | Periodic | Keep webhook subscriptions alive |
| Competitor Update | Cron job | Every 12 hours | Refresh competitor channel data |

---

## 🛡️ Security & Access Control

```mermaid
flowchart TD
    REQ["Incoming Request"]

    REQ --> RLS["Row Level Security\nPostgreSQL RLS Policies"]

    RLS --> CHECK{User Type}

    CHECK -->|Regular User| OWN["Can only read/write\nown user_id rows"]
    CHECK -->|Admin| ADMIN_CHECK{Admin Email Match}

    ADMIN_CHECK -->|admin@blowmeai.com| ALL["Full access to\nall data"]
    ADMIN_CHECK -->|Other| OWN

    OWN --> TABS["Ideation: own channels only\nUSA/Spanish: read-only\n(admin writes for all)"]
    ALL --> GLOBAL["Full CRUD on all tables\nUser management\nGlobal channel distribution"]
```

---

## 📱 Application Routes

| Route | Access | Description |
|---|---|---|
| `/auth` | Public | Email OTP login for regular users |
| `/admin` | Public | Admin email + password login |
| `/` | Protected | Main dashboard (Ideation tab default) |
| `/?tab=ideation` | Protected | Personal competitor tracking |
| `/?tab=usa` | Protected | USA curated content |
| `/?tab=spanish` | Protected | Spanish curated content |
| `/?tab=title-generator` | Protected | AI title generation tool |
| `/tools?tab=script` | Protected | AI script generator |
| `/tools?tab=seo` | Protected | AI SEO generator |
| `/tools?tab=competitor` | Protected | Competitor channel finder |
| `/favorites` | Protected | Bookmarked videos |
| `/admin/dashboard` | Admin only | Admin video management |
| `/admin/users` | Admin only | User management |
| `/admin-stats` | Admin only | Platform analytics |
| `/pending-approval` | Registered | Waiting for admin approval |
| `/blocked` | Blocked | Account blocked notice |

---

## 🔑 Admin Access

> **Admin Login URL:** `/admin`
>
> The admin account is identified by a hardcoded email in the system. The password is managed through Supabase Authentication. Contact the repository owner for credentials.

---

## 🏁 Getting Started

**Prerequisites:** Node.js 18+, a Supabase project, YouTube API key, OpenAI API key

**1 — Clone**

> `git clone https://github.com/syedmozamilshah/yt_management_and_analysis.git`

**2 — Install dependencies**

> `npm install`

**3 — Configure environment** — Create `.env` with your Supabase project URL, anon key, and project ID

**4 — Deploy Supabase** — Run migrations from `supabase/migrations/`, deploy edge functions from `supabase/functions/`

**5 — Start dev server**

> `npm run dev` → open `http://localhost:5173`

---

## 📜 Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start local development server |
| `npm run build` | Build for production |
| `npm run build:dev` | Build in development mode |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint code checks |

---

<div align="center">

Built with ❤️ by the BlowMe AI team · Private & Proprietary

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)

</div>
