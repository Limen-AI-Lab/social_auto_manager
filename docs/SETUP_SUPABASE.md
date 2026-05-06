# Supabase setup for SAMA (storage, auth, and content persistence)

Follow these steps to store uploaded videos and thumbnails, enable sign-in, and persist team members and content projects in Supabase.

---

## 1. Install dependencies

In the project root:

```bash
npm install
```

If you see `ENOTFOUND registry.npmmirror.com` or similar, switch to the default registry and retry:

```bash
npm config set registry https://registry.npmjs.org/
npm install
```

---

## 2. Run database migration (Auth + profiles + content projects)

1. In Supabase Dashboard, go to **SQL Editor**.
2. Run the migration file [`supabase/migrations/20250202000000_auth_and_projects.sql`](../supabase/migrations/20250202000000_auth_and_projects.sql) (copy its contents and execute). This creates:
   - **profiles** table (id, email, display_name, role) linked to `auth.users`
   - **content_projects** table for persisting generated content per user
   - RLS policies and a trigger that creates a profile row when a user signs up
3. **First admin only** (no self-registration): create the first user in Supabase Dashboard → **Authentication** → **Users** → **Add user** (set email and password). The trigger will create a row in `profiles`. Then in **SQL Editor** run:
   ```sql
   update public.profiles set role = 'admin' where email = 'your@email.com';
   ```
   That email and password are the only admin login; the app does not show or store them. All other users are created by the admin via **Settings → Team → Invite Member** (email + temporary password); those users sign in with the credentials the admin set.

---

## 3. Create Storage buckets and RLS policies

**Recommended:** Run the migration [`supabase/migrations/20250203200000_storage_buckets_and_policies.sql`](../supabase/migrations/20250203200000_storage_buckets_and_policies.sql) in **SQL Editor**. It creates:

- `videos` and `thumbnails` buckets (public)
- RLS policies: public read + allow anon/authenticated upload

Without these policies, uploads fail with: `new row violates row-level security policy`.

### Storage file size limits

Supabase enforces a **global file size limit** for Storage:

| Plan       | Max file size |
| ---------- | ------------- |
| Free       | 50 MB         |
| Pro / Team | Up to 500 GB (set in Dashboard) |
| Enterprise | Custom        |

- **Free plan:** The limit is 50 MB per file and cannot be increased. If you see `The object exceeded the maximum allowed size`, compress the video or use a shorter/smaller file.
- **Pro plan:** In [Supabase Dashboard](https://supabase.com/dashboard) go to **Storage** → **Settings** (or the gear icon) and set **Global file size limit** as needed (up to 500 GB). You can also set a per-bucket limit under each bucket’s **Edit bucket** → **Restrict file size**.

### Option A: Migration (recommended)

1. In Supabase Dashboard, go to **SQL Editor**.
2. Copy the contents of `supabase/migrations/20250203200000_storage_buckets_and_policies.sql` and run it.

### Option B: Manual (Dashboard + SQL)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → **Storage**.
2. Create buckets `videos` and `thumbnails` (both public).
3. Add policies via **Storage** → bucket → **Policies**, or run in SQL Editor:

```sql
create policy "Public read for videos and thumbnails"
on storage.objects for select
using (bucket_id in ('videos', 'thumbnails'));

create policy "Allow uploads for videos and thumbnails"
on storage.objects for insert
to anon, authenticated
with check (bucket_id in ('videos', 'thumbnails'));
```

---

## 4. Local environment variables

1. Open your project’s **.env** (or **.env.local**). If it doesn’t exist, copy from the example:

   ```bash
   cp .env.example .env
   ```

2. In Supabase Dashboard go to **Project Settings** → **API**.
   - **Project URL** → use as `VITE_SUPABASE_URL`
   - **Project API keys** → **anon public** → use as `VITE_SUPABASE_ANON_KEY`

3. Add or update these lines in **.env** (replace with your real values):

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. Restart the dev server so Vite picks up the new env vars:

   ```bash
   npm run dev
   ```

---

## 5. Verify

- **Auth**: With env vars set, the app shows a sign-in page when not logged in. There is no self-registration; users sign in only with the email and password provided by an administrator (first admin created in Dashboard; others invited via Settings → Team).
- **Storage**: Upload a video in the app; it should appear in the **videos** bucket. The content project gets a `videoUrl` and the first-frame image appears in **thumbnails**.
- **Content**: After login, projects load from **content_projects**; saving or publishing updates the database. Refresh or sign in again to see persisted data.
- **Team**: In Settings → Team, admins can invite members (email, display name, role, temp password) and edit display name/role. Invites use the **admin-invite-user** Edge Function (users are created with email already confirmed, so they can sign in immediately without verification). When editing a member (not yourself), you can set a new password directly (optional); this calls the **admin-update-password** Edge Function.

**Optional: Admin password update (Edit Member)**  
To let admins change a member’s password from the Edit Member modal, deploy the Edge Function:

```bash
supabase functions deploy admin-update-password
```

The function uses `SUPABASE_SERVICE_ROLE_KEY` (set automatically when deployed via Supabase CLI). It checks that the caller is admin or super_admin via `profiles`, then updates the target user’s password with the Auth Admin API.

If the function is not deployed, leaving the password fields blank still allows editing display name and role; filling the password fields will show an error until the function is deployed.

If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing, the app runs without auth (no login; treated as admin) and does not persist to Supabase.
