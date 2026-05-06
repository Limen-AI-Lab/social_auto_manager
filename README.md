<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1gD_ahdOBnlQBvSI7W63ISBD39pcCYBV6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set:
   - `GEMINI_API_KEY` – your Gemini API key (required for content generation)
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` – optional; when set, uploaded videos and thumbnails are stored in Supabase Storage
3. **Supabase (optional):** To store videos and thumbnails in Supabase, follow [docs/SETUP_SUPABASE.md](docs/SETUP_SUPABASE.md) (install, create `videos` and `thumbnails` buckets, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`).
4. Run the app:
   `npm run dev`
