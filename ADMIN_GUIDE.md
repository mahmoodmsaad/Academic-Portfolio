# Sanity CMS Admin Panel - Complete User Guide

## 🎉 Your Admin Panel is Ready!

You now have a powerful Content Management System to manage **ALL** your portfolio content without touching any code!

---

## 🚀 How to Access Your Admin Panel

### Step 1: Start the Admin Panel Locally

Open terminal and run:
```bash
cd studio
npm run dev
```

This will start your admin panel at: **http://localhost:3333**

### Step 2: Login
- Open http://localhost:3333 in your browser
- Login with your **Google account** (mahmoodmsaad9@gmail.com)
- You're in! 🎉

---

## 📝 What You Can Edit

### 1. 👤 **Personal Information** (Hero Section)
- Your name, title, tagline
- **Profile photo** - Upload your professional headshot
- About me description
- Location, email
- **CV/Resume** - Upload PDF file for download button

### 2. 📸 **Gallery Items** (Research Gallery)
- Upload research activity photos
- Add title, description, date
- Categorize (Research, Conference, Training, etc.)
- Control display order

### 3. 💼 **Experience & Education**
- Add work experiences
- Add educational background
- Job title, organization, location, dates
- Description points (multiple bullet points)
- Type: Experience or Education

### 4. 📚 **Publications**
- Paper title, authors
- Journal/Conference name
- Year, status (Published, Under Review, etc.)
- DOI or publication link
- Display order

### 5. 🔗 **Social Links**
- LinkedIn, GitHub, Email, Twitter, etc.
- Platform URLs
- Icons (automatically displayed on website)

---

## 📸 How to Edit Each Section

### ✏️ Personal Information (Profile Photo & Details)

1. Click **"Personal Information"** in sidebar
2. If empty, click **"+ Create"**
3. Fill in:
   - **Name**: Your full name
   - **Professional Title**: e.g., "PhD Researcher & Materials Engineer"
   - **Tagline**: Your elevator pitch
   - **Profile Photo**: Click "Upload" → Select your photo
   - **About Me**: Your bio (appears in About section)
   - **CV File**: Upload your resume PDF
4. Click **"Publish"**

✅ **Your profile is updated on the website instantly!**

---

### 📸 Adding Gallery Photos

1. Click **"Gallery Item"** in sidebar
2. Click **"+ Create"**
3. Fill in:
   - **Title**: "Lab Work at University"
   - **Description**: What you're doing
   - **Image**: Upload photo
   - **Date**: "2025" or "Jan 2025"
   - **Category**: Choose from dropdown
   - **Display Order**: 1, 2, 3... (lower appears first)
4. Click **"Publish"**

---

### 💼 Adding Experience/Education

1. Click **"Experience"** in sidebar
2. Click **"+ Create"**
3. Fill in:
   - **Job Title**: "PhD Researcher"
   - **Organization**: "University of Trieste"
   - **Location**: "Trieste, Italy"
   - **Date Range**: "Oct 2024 – Current"
   - **Type**: Choose "Experience" or "Education"
   - **Description**: Click "+ Add item" for each bullet point
   - **Display Order**: Optional
4. Click **"Publish"**

---

### 📚 Adding Publications

1. Click **"Publication"** in sidebar
2. Click **"+ Create"**
3. Fill in:
   - **Paper Title**: Full title
   - **Authors**: "M. Saad Mahmood, et al."
   - **Journal**: "Nature Chemistry"
   - **Year**: "2025"
   - **Status**: Published, Under Review, etc.
   - **Link**: DOI or URL (optional)
   - **Display Order**: Optional
4. Click **"Publish"**

---

### 🔗 Adding Social Links

1. Click **"Social Link"** in sidebar
2. Click **"+ Create"**
3. Fill in:
   - **Platform**: Choose from dropdown
   - **URL**: Your profile link
   - **Icon Name**: Choose icon
4. Click **"Publish"**

---

## ✏️ How to Edit Existing Content

1. Click the content type in sidebar (e.g., "Gallery Item")
2. Click on the item you want to edit
3. Make your changes
4. Click **"Publish"**

---

## 🗑️ How to Delete Items

1. Click on the item
2. Click the **"..."** menu (top right)
3. Select **"Delete"**
4. Confirm

---

## 🌐 Deploying Your Admin Panel Online

### To access your admin from anywhere (not just localhost):

```bash
cd studio
npm run build
npx sanity deploy
```

Choose a unique studio name (e.g., `mahmood-academic-portfolio`)

This will give you a URL like: **https://mahmood-academic-portfolio.sanity.studio**

You can then login from anywhere and manage your content!

---

## 💡 Important Tips

### Images:
- **Profile photo**: Square aspect ratio (400x400px) recommended
- **Gallery photos**: 1200x900px or similar (4:3 ratio)
- **File size**: Keep under 2MB for fast loading
- **Format**: JPG or PNG

### Content:
- **Display Order**: Use numbers 1, 2, 3... to control order
- **Required fields**: Marked with asterisk (*) - must fill before publishing
- **Changes are instant**: Website updates automatically within seconds!

### Best Practices:
- Add one item at a time and check website
- Use consistent categories in gallery
- Keep descriptions concise and clear
- Update CV file when you have new version

---

## 🔐 Security

- ✅ Only YOU can access admin panel (your Google account)
- ✅ Visitors can only VIEW website, not edit
- ✅ All content securely stored in Sanity's cloud
- ✅ Automatic backups
- ✅ No one else can modify your portfolio

---

## 📱 Admin Panel Features

- **Rich Text Editor**: Format descriptions
- **Drag & Drop**: Upload images easily
- **Preview**: See images before publishing
- **Search**: Find content quickly
- **History**: See previous versions
- **Auto-save**: Drafts saved automatically

---

## 🎯 Quick Start Checklist

Before your website goes fully live, add this content in admin:

### Must Do:
- [ ] Personal Information (with profile photo)
- [ ] At least 3 Social Links
- [ ] Upload CV file
- [ ] Add current work experience
- [ ] Add education history
- [ ] Add at least 1 publication

### Nice to Have:
- [ ] 3-5 gallery photos
- [ ] All publications
- [ ] Complete bio

---

## 🆘 Troubleshooting

**Admin panel won't start?**
```bash
cd studio
npm install
npm run dev
```

**Changes not showing on website?**
- Wait 30 seconds and refresh browser
- Clear browser cache (Ctrl+Shift+R)
- Check if you clicked "Publish" (not just Save)

**Can't upload images?**
- Check file size (must be under 10MB)
- Use JPG or PNG format
- Check internet connection

**Can't login?**
- Use mahmoodmsaad9@gmail.com
- Check internet connection
- Try incognito/private window

**Website showing old content?**
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Clear browser cache
- Wait 1-2 minutes for CDN to update

---

## 📞 Project Details

- **Project ID**: svudrtoe
- **Dataset**: production
- **Local Admin**: http://localhost:3333
- **Online Admin** (after deploy): https://your-studio-name.sanity.studio

---

## 🎯 What's Next?

1. **Start admin panel**: `cd studio && npm run dev`
2. **Add your personal info & profile photo**
3. **Add your experience & education**
4. **Add publications**
5. **Add gallery photos**
6. **Upload CV file**
7. **Deploy admin online**: `npx sanity deploy`
8. **Manage from anywhere!**

---

## 🚀 You're All Set!

Your entire portfolio is now manageable through a beautiful admin interface. No more code editing needed!

Just login, update content, click publish, and your changes are live! 🎉

Enjoy your new content management system! 📝✨
