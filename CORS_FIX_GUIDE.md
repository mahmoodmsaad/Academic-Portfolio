# Fix CORS Error - Sanity Configuration

## Problem
The website shows "Loading..." because Sanity.io is blocking API requests from `mah-mood.live` due to CORS (Cross-Origin Resource Sharing) restrictions.

## Solution: Add CORS Origins in Sanity Dashboard

### Step 1: Go to Sanity Management Dashboard
Visit: https://www.sanity.io/manage/personal/project/svudrtoe

### Step 2: Navigate to API Settings
1. Click on your project "Academic Portfolio"
2. Go to **API** settings in the sidebar
3. Look for **CORS Origins** section

### Step 3: Add Allowed Origins
Click "Add CORS origin" and add these URLs one by one:

```
https://mah-mood.live
https://*.amplifyapp.com
http://localhost:3002
http://localhost:5173
```

For each origin:
- Check ✅ **Allow credentials**
- Save

### Step 4: Verify
After adding origins, wait 2-3 minutes for changes to propagate, then refresh your website.

## Alternative: Use Public Token (Not Recommended for Production)

If CORS continues to be an issue, you can create a public read token:

1. Go to https://www.sanity.io/manage/personal/project/svudrtoe/api/tokens
2. Click "Add API token"
3. Name: "Public Read Token"
4. Permissions: **Viewer** (read-only)
5. Copy the token

Then update `/sanity/client.ts`:
```typescript
export const client = createClient({
  projectId: 'svudrtoe',
  dataset: 'production',
  useCdn: true,
  apiVersion: '2024-01-01',
  token: 'YOUR_PUBLIC_TOKEN_HERE', // Add this line
})
```

## Current Status
✅ Website displays fallback content (your original data from constants.ts)  
✅ All sections are visible and working  
❌ Sanity CMS data won't load until CORS is fixed  

Once CORS is configured correctly:
- You can edit content through https://saad.sanity.studio/
- Changes will appear on your live website
- No code deployment needed for content updates
