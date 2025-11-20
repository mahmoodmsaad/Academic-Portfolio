# AWS Deployment Guide for mah-mood.live

Your portfolio is ready to deploy! Follow these steps to host it on AWS Amplify.

## ✅ What's Already Done

- ✅ Git repository initialized
- ✅ AWS Amplify configuration created (`amplify.yml`)
- ✅ Project builds successfully
- ✅ All files committed to Git

## 📋 Next Steps

### Step 1: Push to GitHub

1. **Create a new repository on GitHub:**
   - Go to https://github.com/new
   - Name: `academic-portfolio` (or any name you prefer)
   - Keep it **Public** or **Private** (both work with Amplify)
   - **DO NOT** initialize with README (your project already has one)
   - Click "Create repository"

2. **Push your code:**
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/academic-portfolio.git
   git push -u origin main
   ```
   Replace `YOUR_USERNAME` with your GitHub username.

### Step 2: Deploy to AWS Amplify

1. **Sign in to AWS Console:**
   - Go to https://console.aws.amazon.com/
   - Sign in with your account (that has $100 credit)

2. **Open AWS Amplify:**
   - Search for "Amplify" in the AWS Console search bar
   - Click on "AWS Amplify"

3. **Create New App:**
   - Click "New app" → "Host web app"
   - Choose "GitHub" as your Git provider
   - Click "Continue"
   - Authorize AWS Amplify to access your GitHub account

4. **Select Repository:**
   - Choose your repository: `academic-portfolio`
   - Choose branch: `main`
   - Click "Next"

5. **Configure Build Settings:**
   - App name: `mah-mood-portfolio` (or any name)
   - Amplify will auto-detect the build settings from `amplify.yml`
   - You should see:
     - Build command: `npm run build`
     - Output directory: `dist`
   - Click "Next"

6. **Review and Deploy:**
   - Review all settings
   - Click "Save and deploy"
   - Wait 2-5 minutes for the first deployment

### Step 3: Connect Your Domain (mah-mood.live)

1. **In AWS Amplify Console:**
   - Go to your app
   - Click "Domain management" in left sidebar
   - Click "Add domain"

2. **Enter your domain:**
   - Type: `mah-mood.live`
   - Click "Configure domain"

3. **Update DNS Settings:**
   - AWS will provide DNS records (usually CNAME or ANAME records)
   - Go to your domain registrar (where you bought mah-mood.live)
   - Add the DNS records AWS provides
   - Common records:
     ```
     Type: CNAME
     Name: www
     Value: [provided by AWS]
     
     Type: ANAME/ALIAS (or A record)
     Name: @
     Value: [provided by AWS]
     ```

4. **Wait for DNS Propagation:**
   - This can take 5 minutes to 48 hours
   - AWS will automatically provision SSL certificate (HTTPS)
   - Your site will be live at https://mah-mood.live

## 🎉 You're Done!

Your portfolio will be live with:
- ✅ Automatic HTTPS (SSL certificate)
- ✅ CDN (CloudFront) for fast global access
- ✅ Auto-deploy on every git push
- ✅ Free hosting (well within AWS free tier)

## 💰 Cost Estimate

- **Build minutes**: ~1-2 minutes per deployment
- **Data transfer**: Minimal for a portfolio
- **Storage**: Tiny (your site is ~225 KB)
- **Monthly cost**: ~$0-$1 (your $100 credit will last years!)

## 🔄 Making Updates

After initial setup, just push to GitHub:
```bash
git add .
git commit -m "Updated portfolio"
git push
```
AWS Amplify will automatically rebuild and deploy!

## 📞 Need Help?

If you encounter issues:
1. Check AWS Amplify build logs in the console
2. Verify DNS settings in your domain registrar
3. Ensure GitHub repository is accessible to AWS Amplify

---

**Your project is ready to go live! Just follow the steps above.** 🚀
