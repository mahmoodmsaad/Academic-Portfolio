# How to Add Photos to Your Gallery

## 📸 Adding New Photos

1. **Save your photos** with descriptive names (e.g., `lab-work-2024.jpg`, `conference-presentation.jpg`)

2. **Copy photos** to this folder:
   `public/images/gallery/`

3. **Update the gallery** by editing `components/Gallery.tsx`:
   - Find the `GALLERY_ITEMS` array
   - Add a new entry like this:

```typescript
{
  id: "4",  // Increment the number
  image: "/images/gallery/your-photo-name.jpg",
  title: "Your Activity Title",
  description: "Describe what you're doing in this photo",
  date: "2025",
  category: "Research"  // Options: Research, Conference, Training, Lab Work, etc.
}
```

4. **Push to GitHub**:
```bash
git add .
git commit -m "Add new gallery photos"
git push
```

## 📁 Recommended Photo Names

- `activity1.jpg`, `activity2.jpg`, etc. (simple numbering)
- Or descriptive names: `lab-xps-2024.jpg`, `conference-trieste-2025.jpg`

## 🎨 Categories

You can use these categories or create your own:
- Research
- Conference
- Training
- Lab Work
- Collaboration
- Fieldwork

## 📏 Photo Requirements

- **Format**: JPG, PNG
- **Size**: Recommended 1200x900px or similar aspect ratio (4:3)
- **File size**: Keep under 2MB for faster loading

Your photos will automatically display in a beautiful responsive grid with lightbox functionality!
