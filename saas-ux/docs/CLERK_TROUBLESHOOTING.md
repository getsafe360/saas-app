# Clerk Configuration Troubleshooting

## Issue: 404 Errors on clerk.getsafe360.ai

The console error:
```
Failed to load resource: the server responded with a status of 404
clerk.getsafe360.ai/v1/client/sessions/sess_.../touch
```

This indicates Clerk's frontend API cannot be reached at your custom domain.

## Root Cause

The DNS CNAME record for `clerk.getsafe360.ai` is pointing to `frontend-api.clerk.services`, which is **INCORRECT**.

## Solution

### Step 1: Check Your Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Go to **Domains** (in the left sidebar)
4. Look for the **Frontend API** section

### Step 2: Get the Correct CNAME Target

Clerk should show you something like:

```
Production Frontend API Domain:
clerk.getsafe360.ai → clerk.YOUR_INSTANCE.accounts.dev
```

The exact value will be something like:
- `clerk-frontend-XXXXX.clerk.accounts.dev` OR
- `frontend-api.clerk.YOUR_INSTANCE.dev` OR
- A similar Clerk-provided domain

**DO NOT use** `frontend-api.clerk.services` - this is not a valid Clerk endpoint!

### Step 3: Update DNS Records

In your DNS provider (Vercel, Cloudflare, etc.):

1. Find the CNAME record for `clerk.getsafe360.ai`
2. Update the target to the **exact value** Clerk provides
3. Example:
   ```
   Type: CNAME
   Name: clerk.getsafe360.ai
   Target: clerk-frontend-abc123.clerk.accounts.dev
   ```

### Step 4: Wait for DNS Propagation

- DNS changes can take 5-60 minutes
- Check status: `nslookup clerk.getsafe360.ai`
- Should resolve to Clerk's infrastructure

### Step 5: Verify Environment Variables

Ensure your `.env.local` has:

```bash
# Clerk Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Optional: If using custom domain
NEXT_PUBLIC_CLERK_FRONTEND_API=https://clerk.getsafe360.ai
```

**IMPORTANT:** The publishable key should start with `pk_live_` for production.

## Alternative: Use Default Clerk Domain

If custom domain setup is problematic, you can temporarily use Clerk's default domain:

1. Remove the custom domain from Clerk Dashboard
2. Remove `NEXT_PUBLIC_CLERK_FRONTEND_API` from `.env.local`
3. Clerk will automatically use: `https://YOUR_CLERK_INSTANCE.clerk.accounts.dev`

This will work immediately while you troubleshoot the custom domain.

## How to Test

### 1. Check DNS Resolution
```bash
nslookup clerk.getsafe360.ai
```

Should return Clerk's IP addresses, not your own server.

### 2. Test Frontend API Endpoint
```bash
curl https://clerk.getsafe360.ai/v1/environment
```

Should return JSON, not a 404.

### 3. Check Browser Console
- Open DevTools → Network tab
- Filter by "clerk"
- Look for 200 status codes, not 404

## Common Mistakes

❌ **Wrong:** `frontend-api.clerk.services`
✅ **Correct:** Value from Clerk Dashboard (usually `clerk-frontend-*.clerk.accounts.dev`)

❌ **Wrong:** Pointing to your own server
✅ **Correct:** Pointing to Clerk's infrastructure

❌ **Wrong:** Using test keys in production
✅ **Correct:** Using `pk_live_*` and `sk_live_*` keys

## Need Help?

If the issue persists:

1. **Verify Publishable Key:**
   - Dashboard → API Keys → Copy the Production Publishable Key
   - Ensure it starts with `pk_live_`

2. **Check Clerk Status:**
   - Visit [status.clerk.com](https://status.clerk.com)

3. **Contact Clerk Support:**
   - Dashboard → Help → Contact Support
   - Include the 404 error details
