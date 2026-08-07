# 📘 How to Use Profile Auto-Update

## Quick Start Guide

### Step 1: Go to Your Profile
Navigate to **Dealer Profile** page

### Step 2: Click "Analyze Website"
In the **AI Knowledge Enhancement** card, click the "Analyze Website" button

```
┌─────────────────────────────────────┐
│ 🧠 AI Knowledge Enhancement         │
│                                      │
│ [🔄 Analyze Website]                │
└─────────────────────────────────────┘
```

### Step 3: Wait for Analysis
The button shows "Analyzing Website..." with a spinning icon

### Step 4: Review Suggestions
If information is found, a **purple panel** appears:

```
┌─────────────────────────────────────────┐
│ ✨ Profile Updates Available       [×]  │
│                                          │
│ We found information that can enhance   │
│ your profile:                           │
│                                          │
│ ┌────────────────────────────────────┐ │
│ │ Business Description:               │ │
│ │ Family-owned dealership serving...  │ │
│ └────────────────────────────────────┘ │
│                                          │
│ ┌────────────────────────────────────┐ │
│ │ Established Year:                   │ │
│ │ 1995                                │ │
│ └────────────────────────────────────┘ │
│                                          │
│ [✓ Apply Updates]  [Dismiss]           │
└─────────────────────────────────────────┘
```

### Step 5: Choose Action

#### Option A: Apply Updates ✅
Click **"Apply Updates"** to automatically update your profile

**What happens**:
1. Profile description gets updated
2. Established year gets set
3. Changes save to database
4. Profile refreshes with new data
5. Success toast notification appears
6. Suggestions panel disappears

#### Option B: Dismiss ❌
Click **"Dismiss"** to ignore suggestions

**What happens**:
1. Suggestions panel closes
2. Profile remains unchanged
3. You can edit manually later

## 🎯 What Gets Updated

### Business Description
Your profile's **description field** gets populated with:
- Company overview
- Service highlights
- About us content
- Mission statement

**Example**:
```
Before: (empty)
After: "Family-owned dealership serving the Dallas area since 1995. 
        We specialize in new and used vehicles with exceptional 
        customer service..."
```

### Established Year
Your profile's **established year** gets set:
- Company founding year
- Calculated from "years in business"
- Validated to be reasonable (1900-present)

**Example**:
```
Before: (empty)
After: 1995
```

## 🔍 What the Analyzer Looks For

### On Your Website

#### For Description:
✅ Meta description tags
✅ About Us sections
✅ Company overview paragraphs
✅ Homepage intro text

#### For Established Year:
✅ "Established in 1995"
✅ "Since 1998"
✅ "Founded in 2000"
✅ "Serving since 1985"
✅ "Over 25+ years"
✅ "In business since 1990"

## ⚠️ Important Notes

### When Suggestions Don't Appear
If you don't see the purple panel, it means:
- ❌ No clear business description found
- ❌ No established year mentioned
- ❌ Content not detectable/readable

**Solution**: 
- Add clear "About Us" section to website
- Mention established/founded year
- Use proper HTML structure

### When Partial Suggestions Appear
You might only see:
- Description only (no year found)
- Year only (no description found)

**Both are valid** - apply what you need!

### After Applying Updates
- ✅ Changes are permanent
- ✅ You can edit manually later
- ✅ Re-running analyzer won't overwrite
- ✅ You'll need to manually dismiss if ran again

## 💡 Best Practices

### 1. Review Before Applying
Always **read the suggested description** to make sure it:
- Sounds professional
- Accurately represents your business
- Doesn't include errors or strange text
- Is appropriate length

### 2. Verify the Year
Check that the **established year** is:
- Correct for your business
- Not a random date from website
- Makes sense (not too old/recent)

### 3. When to Dismiss
Dismiss suggestions if:
- Description is not accurate
- Year is wrong
- You prefer manual editing
- Content seems off

### 4. Re-running Analysis
You can analyze **multiple times**:
- After website updates
- After dismissing previous suggestions
- To get fresh data
- Each run is independent

## 🎬 Complete Example Walkthrough

### Scenario: First-Time Profile Setup

#### Your Website Says:
```
"About Clay Cooley Hyundai

Since 1995, Clay Cooley Hyundai has been serving the Dallas 
metroplex with exceptional customer service. As a family-owned 
dealership, we pride ourselves on our commitment to quality 
vehicles and transparent pricing."
```

#### Step-by-Step:

**1. Click "Analyze Website"**
```
🔄 Analyzing Website...
```

**2. Analysis Completes**
```
✓ Analysis Complete!
Found 3 categories: about, contact, hours
15 pieces of information extracted
```

**3. Suggestions Appear**
```
✨ Profile Updates Available

Business Description:
"Since 1995, Clay Cooley Hyundai has been serving the Dallas 
metroplex with exceptional customer service. As a family-owned 
dealership, we pride ourselves on..."

Established Year:
1995

[✓ Apply Updates]  [Dismiss]
```

**4. You Click "Apply Updates"**
```
🔄 Applying...
```

**5. Success!**
```
✓ Profile Updated
Your dealer profile has been updated with information 
from your website.
```

**6. Profile Now Shows**
```
Business Name: Clay Cooley Hyundai
Description: "Since 1995, Clay Cooley Hyundai has been..."
Established: 1995
```

## 🔧 Troubleshooting

### Issue: Button Keeps Loading
**Problem**: "Analyzing Website..." doesn't complete

**Solutions**:
1. Check your internet connection
2. Verify website URL is correct in profile
3. Wait 30 seconds (large sites take time)
4. Check browser console for errors
5. Refresh page and try again

### Issue: No Suggestions Appear
**Problem**: Analysis completes but no purple panel

**Reasons**:
- Website doesn't have clear About section
- No year mentioned anywhere on site
- Content is in images (not readable)
- Website requires login/authentication

**Solutions**:
1. Add About Us section to website
2. Include "Established" or "Since" year
3. Make content text-based, not images
4. Check website is publicly accessible

### Issue: Wrong Information Extracted
**Problem**: Description or year is incorrect

**Solutions**:
1. Click "Dismiss" - don't apply
2. Edit profile manually
3. Update website content to be clearer
4. Contact support if persistent

### Issue: Apply Button Doesn't Work
**Problem**: Click "Apply Updates" but nothing happens

**Solutions**:
1. Check you're logged in
2. Verify you have admin permissions
3. Check browser console for errors
4. Try refreshing page
5. Log out and back in

## 🎉 Success Checklist

After using the feature, verify:

- [ ] Clicked "Analyze Website"
- [ ] Saw analysis complete message
- [ ] Reviewed suggestions in purple panel
- [ ] Clicked "Apply Updates" or "Dismiss"
- [ ] Profile updated correctly (if applied)
- [ ] Description field populated
- [ ] Established year shows
- [ ] No errors in browser console
- [ ] Changes visible on profile page

## 🚀 Tips for Best Results

### Optimize Your Website

For best extraction results, ensure your website has:

#### Clear About Section
```html
<section class="about">
  <h2>About Us</h2>
  <p>Family-owned dealership since 1995...</p>
</section>
```

#### Visible Company Info
- Put important info in first few paragraphs
- Use proper HTML tags (not images for text)
- Include meta description tag
- Make year prominent

#### Structured Content
```html
<meta name="description" content="Your business description">
<h1>About [Your Dealership]</h1>
<p>Since [year], we have been...</p>
```

### Multiple Pages
The analyzer checks your homepage. If info is on "About" page:
1. Link prominently from homepage
2. Include summary on homepage
3. Or update profile manually from About page content

## 📞 Need Help?

If you encounter issues:
1. Check this guide first
2. Review console for errors
3. Verify website accessibility
4. Check permissions/auth status
5. Contact support with:
   - What you tried
   - Error messages
   - Website URL
   - Browser used

---

## Quick Reference Card

```
┌────────────────────────────────────────┐
│ PROFILE AUTO-UPDATE QUICK REFERENCE    │
├────────────────────────────────────────┤
│ 1. Go to Dealer Profile                │
│ 2. Scroll to AI Knowledge Enhancement  │
│ 3. Click "Analyze Website"             │
│ 4. Wait for analysis                   │
│ 5. Review purple suggestions panel     │
│ 6. Click "Apply Updates" or "Dismiss"  │
│ 7. Done! ✓                             │
└────────────────────────────────────────┘

WHAT GETS UPDATED:
• Business Description
• Established Year

WHERE TO FIND:
• Profile Page > AI Knowledge card
• Purple "Profile Updates Available" panel

WHEN TO USE:
• First-time profile setup
• After website updates
• Profile info incomplete
• Want accurate AI context
```

---

That's it! The feature is designed to be simple and intuitive. Just click, review, and apply! 🎉
