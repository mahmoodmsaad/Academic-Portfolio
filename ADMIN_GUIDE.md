# Sanity CMS Admin Panel - User Guide

## 🎉 Your Admin Panel is Ready!

You now have a powerful Content Management System to manage your portfolio without touching any code!

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

## 📸 How to Add Photos to Gallery

### Adding a New Gallery Item:

1. **Click "Gallery Item"** in the left sidebar
2. **Click the "+ Create" button** (top right)
3. **Fill in the form**:
   - **Title**: e.g., "Lab Work at University of Trieste"
   - **Description**: Describe the activity
   - **Image**: Click "Upload" and select your photo
   - **Date**: e.g., "2025" or "Jan 2025"
   - **Category**: Choose from dropdown (Research, Conference, Training, etc.)
   - **Display Order**: Optional number (lower = appears first)
4. **Click "Publish"** (bottom right)

✅ **Your photo is now live on your website!**

---

## ✏️ How to Edit Existing Items

1. Click "Gallery Item" in sidebar
2. Click on the item you want to edit
3. Make your changes
4. Click "Publish"

---

## 🗑️ How to Delete Items

1. Click on the item
2. Click the "..." menu (top right)
3. Select "Delete"
4. Confirm

---

## 🌐 Deploying Your Admin Panel Online

### To access your admin from anywhere:

```bash
cd studio
npm run build
npx sanity deploy
```

This will give you a URL like: **https://academic-portfolio.sanity.studio**

You can then login from anywhere and manage your content!

---

## 💡 Tips

- **Images**: Use JPG or PNG, keep under 2MB for fast loading
- **Categories**: Stick to the predefined categories for consistency
- **Display Order**: Use numbers like 1, 2, 3... to control order
- **Changes are instant**: Once you publish, your website updates automatically!

---

## 🔐 Security

- Only YOU can access the admin panel (your Google account)
- Visitors can only VIEW your website, not edit
- All content is securely stored in Sanity's cloud

---

## 📱 Project Details

- **Project ID**: svudrtoe
- **Dataset**: production
- **Admin URL** (after deploy): Will be provided after running `npx sanity deploy`

---

## 🆘 Troubleshooting

**Admin panel won't start?**
```bash
cd studio
npm install
npm run dev
```

**Changes not showing on website?**
- Wait 30 seconds and refresh your browser
- Clear browser cache

**Can't login?**
- Make sure you're using mahmoodmsaad9@gmail.com
- Check your internet connection

---

## 🎯 What's Next?

1. Start your admin panel: `cd studio && npm run dev`
2. Add your first gallery photo
3. Deploy admin online: `npx sanity deploy`
4. Manage your portfolio from anywhere!

Enjoy your new admin panel! 🚀
