# SAMA - Social Auto Manager

Social Media Analytics & Reporting Platform

---

## Features

- **Multi-Platform Analytics**: Track performance across LinkedIn, Facebook, Instagram, YouTube, Twitter/X, and TikTok
- **Daily Reports**: Real-time daily performance metrics
- **Weekly Reports**: Weekly performance overview with trend analysis
- **Monthly Reports**: Comprehensive monthly reports with detailed breakdowns
- **Excel Export**: Export reports to Excel format for presentations

---

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **API Integration**: Ayrshare API
- **Backend**: Supabase Edge Functions
- **Caching**: Supabase Database Cache

---

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_KEY=your-service-key
```

### 3. Supabase Configuration (Optional - for caching)

For better performance and incremental data fetching:

1. Deploy the Supabase Edge Function:
   ```bash
   cd supabase
   supabase functions deploy get-ayrshare-analytics
   ```

2. Configure Edge Function secrets in Supabase Dashboard:
   - `AYRSHARE_API_KEY`: Your Ayrshare API key
   - `REPORT_SECRET`: Team shared secret
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key

3. Execute the database migration in Supabase SQL Editor:
   ```sql
   CREATE TABLE IF NOT EXISTS sama_post_cache (
     post_id TEXT NOT NULL,
     profile_key TEXT NOT NULL,
     created TEXT,
     fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY (post_id, profile_key)
   );
   ```

---

## Development

```bash
# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

---

## Project Structure

```
├── components/           # React components
│   └── AnalyticsReport.tsx  # Main report component
├── services/            # Business logic
│   ├── dailyReportService.ts
│   ├── weeklyReportService.ts
│   ├── monthlyReportService.ts
│   └── supabaseApi.ts      # Supabase API layer
├── context/             # React context providers
├── lib/                 # Utility libraries
├── supabase/            # Supabase Edge Functions
│   └── functions/
│       └── get-ayrshare-analytics/
└── docs/                # Documentation
```

---

## License

Private - All rights reserved
