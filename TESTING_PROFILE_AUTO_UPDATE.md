# 🧪 Testing Guide: Profile Auto-Update Feature

## Prerequisites

Before testing, ensure:
- ✅ Backend server running on `http://localhost:3000`
- ✅ Frontend server running on `http://localhost:8080`
- ✅ Database connection working
- ✅ You're logged in as admin user
- ✅ You have `daive_settings_management` permission
- ✅ Your dealer profile has a valid website URL

---

## Test Suite

### Test 1: Basic Extraction and Application

**Objective**: Verify the complete workflow works end-to-end

#### Steps:
1. Log in to the application
2. Navigate to **Dealer Profile** page
3. Ensure your profile has a website URL set (e.g., `https://example-dealership.com`)
4. Scroll to **AI Knowledge Enhancement** card
5. Click **"Analyze Website"** button

#### Expected Results:
- ✅ Button changes to "Analyzing Website..." with spinning icon
- ✅ Wait 5-30 seconds for analysis
- ✅ Button returns to normal state
- ✅ Green "Analysis Complete!" message appears
- ✅ Shows number of categories found
- ✅ Shows number of entries stored

#### If Suggestions Found:
- ✅ Purple "Profile Updates Available" panel appears
- ✅ Panel shows extracted description (if found)
- ✅ Panel shows established year (if found)
- ✅ "Apply Updates" and "Dismiss" buttons visible

#### Click "Apply Updates":
- ✅ Button shows "Applying..." with spinning icon
- ✅ Success toast appears: "Profile Updated"
- ✅ Purple panel disappears
- ✅ Profile page shows updated description
- ✅ Profile page shows updated established year
- ✅ Database has been updated

---

### Test 2: Dismiss Suggestions

**Objective**: Verify dismiss functionality

#### Steps:
1. Follow Test 1 steps 1-5
2. Wait for purple suggestions panel to appear
3. Click **"Dismiss"** button

#### Expected Results:
- ✅ Purple panel disappears immediately
- ✅ Profile remains unchanged
- ✅ No database updates made
- ✅ No toast notifications

#### Then:
4. Click **"Analyze Website"** again
5. Purple panel appears again (suggestions persist)
6. Can apply or dismiss again

---

### Test 3: No Suggestions Scenario

**Objective**: Verify behavior when no profile data found

#### Steps:
1. Create a test dealer profile
2. Set website URL to a simple site with no About section
3. Navigate to profile page
4. Click **"Analyze Website"**

#### Expected Results:
- ✅ Analysis completes normally
- ✅ Green completion message shows
- ✅ Purple suggestions panel does NOT appear
- ✅ Only knowledge extraction results shown
- ✅ No errors in console

---

### Test 4: Partial Suggestions

**Objective**: Verify behavior when only some data is found

#### Scenario A: Year Only
1. Use a website that mentions "Since 1995" but has no clear description
2. Analyze website

**Expected**:
- ✅ Purple panel appears
- ✅ Shows established year: 1995
- ✅ Does NOT show description section
- ✅ Apply Updates button works
- ✅ Only year field is updated

#### Scenario B: Description Only
1. Use a website with meta description but no year mentioned
2. Analyze website

**Expected**:
- ✅ Purple panel appears
- ✅ Shows business description
- ✅ Does NOT show established year section
- ✅ Apply Updates button works
- ✅ Only description field is updated

---

### Test 5: Close Button (X)

**Objective**: Verify close button in suggestions panel

#### Steps:
1. Analyze website
2. Wait for purple panel to appear
3. Click the **[X]** button in top right of panel

#### Expected Results:
- ✅ Panel closes immediately
- ✅ Same behavior as "Dismiss" button
- ✅ Profile unchanged
- ✅ No errors

---

### Test 6: Multiple Analyses

**Objective**: Verify can run analysis multiple times

#### Steps:
1. Click "Analyze Website"
2. Wait for completion
3. Dismiss suggestions (if any)
4. Click "Analyze Website" again
5. Repeat 3-4 times

#### Expected Results:
- ✅ Each analysis completes successfully
- ✅ Suggestions appear each time (if found)
- ✅ No duplicate entries in database
- ✅ No memory leaks
- ✅ No errors in console

---

### Test 7: Apply After Previous Apply

**Objective**: Verify behavior when re-running after already applying

#### Steps:
1. Analyze website
2. Apply suggestions
3. Verify profile updated
4. Analyze website again
5. Suggestions appear again (same data)
6. Apply again

#### Expected Results:
- ✅ Second apply also works
- ✅ Profile updated (or unchanged if same data)
- ✅ No duplicate entries
- ✅ No errors
- ✅ Success toast appears

---

### Test 8: Invalid Website URL

**Objective**: Verify error handling for bad URLs

#### Steps:
1. Edit dealer profile
2. Set website URL to invalid value: `https://thiswebsitedoesnotexist12345.com`
3. Save profile
4. Click "Analyze Website"

#### Expected Results:
- ✅ Analysis attempt made
- ✅ Error message appears (graceful failure)
- ✅ No suggestions panel
- ✅ Error toast notification
- ✅ No server crash
- ✅ Can try again

---

### Test 9: Empty Profile Fields

**Objective**: Verify works when profile description/year are empty

#### Steps:
1. Edit dealer profile
2. Clear description field (if set)
3. Clear established year field (if set)
4. Save profile
5. Analyze website with valid URL

#### Expected Results:
- ✅ Analysis completes
- ✅ Suggestions appear (if data found)
- ✅ Apply Updates successfully populates empty fields
- ✅ Database updated correctly

---

### Test 10: Pre-filled Profile Fields

**Objective**: Verify works when profile already has data

#### Steps:
1. Edit dealer profile
2. Set description: "Original description"
3. Set established year: 2000
4. Save profile
5. Analyze website (that has different data)
6. Apply suggestions

#### Expected Results:
- ✅ Suggestions show new data from website
- ✅ Apply Updates **overwrites** existing data
- ✅ Profile shows new description and year
- ✅ Old data is replaced (not appended)

---

### Test 11: Long Descriptions

**Objective**: Verify handling of very long descriptions

#### Test with website that has:
- **Too short** (< 50 chars): Not extracted
- **Good length** (50-500 chars): Extracted ✓
- **Very long** (> 1000 chars): Truncated or rejected

#### Expected Results:
- ✅ Too short: Not suggested
- ✅ Good length: Suggested and applied
- ✅ Too long: Either truncated to 1000 chars or not suggested
- ✅ No database errors
- ✅ No UI overflow issues

---

### Test 12: Special Characters

**Objective**: Verify proper handling of special characters

#### Test with description containing:
- Quotes: `"` and `'`
- Apostrophes: `it's`, `we're`
- Ampersands: `&`
- Special chars: `é`, `ñ`, `ü`
- Emoji: 🚗 🎉

#### Expected Results:
- ✅ All characters preserved correctly
- ✅ No SQL injection attempts work
- ✅ No XSS vulnerabilities
- ✅ Description displays correctly in UI
- ✅ Database stores correctly

---

### Test 13: Concurrent Analysis

**Objective**: Verify behavior with multiple quick clicks

#### Steps:
1. Click "Analyze Website"
2. Immediately click it again (before first completes)
3. Click multiple times rapidly

#### Expected Results:
- ✅ Button disables during analysis (prevents multiple clicks)
- ✅ Only one analysis runs at a time
- ✅ No race conditions
- ✅ No duplicate database entries
- ✅ Completes successfully

---

### Test 14: Permissions Check

**Objective**: Verify permission requirements

#### Steps:
1. Log in as user WITHOUT `daive_settings_management` permission
2. Navigate to Dealer Profile
3. Try to access Analyze Website feature

#### Expected Results:
- ✅ Feature not visible, OR
- ✅ Button disabled, OR
- ✅ Error message on click
- ✅ No unauthorized access to endpoints
- ✅ 403 Forbidden from API

---

### Test 15: Network Errors

**Objective**: Verify graceful handling of network issues

#### Scenario A: Backend Down
1. Stop backend server
2. Click "Analyze Website"

**Expected**:
- ✅ Error toast appears
- ✅ User-friendly error message
- ✅ Button returns to normal state
- ✅ Can retry when backend is back

#### Scenario B: Slow Network
1. Throttle network in DevTools
2. Click "Analyze Website"

**Expected**:
- ✅ Loading state persists
- ✅ Eventually completes or times out
- ✅ No frozen UI
- ✅ Appropriate timeout message

---

### Test 16: Database Validation

**Objective**: Verify data is correctly stored in database

#### Steps:
1. Analyze website and apply updates
2. Check database directly:

```sql
-- Check dealer profile
SELECT id, business_name, description, established_year
FROM dealers
WHERE id = 'your-dealer-id';

-- Check knowledge base
SELECT category, data_key, data_value
FROM dealer_knowledge_base
WHERE dealer_id = 'your-dealer-id'
ORDER BY created_at DESC;

-- Check summary view
SELECT *
FROM dealer_knowledge_summary
WHERE dealer_id = 'your-dealer-id';
```

#### Expected Results:
- ✅ `dealers.description` updated
- ✅ `dealers.established_year` updated
- ✅ `dealer_knowledge_base` has entries
- ✅ All data properly formatted
- ✅ Timestamps are correct

---

### Test 17: Browser Compatibility

**Objective**: Verify works across browsers

#### Test in:
- ✅ Google Chrome
- ✅ Mozilla Firefox
- ✅ Microsoft Edge
- ✅ Safari (if available)

#### Expected Results:
- ✅ UI displays correctly
- ✅ Button clicks work
- ✅ API calls succeed
- ✅ Toasts appear
- ✅ Animations smooth
- ✅ No console errors

---

### Test 18: Mobile Responsiveness

**Objective**: Verify mobile/tablet display

#### Steps:
1. Open DevTools
2. Toggle device toolbar
3. Test on:
   - iPhone 12/13 (390x844)
   - iPad (768x1024)
   - Galaxy S20 (360x800)

#### Expected Results:
- ✅ Suggestions panel fits screen
- ✅ Text doesn't overflow
- ✅ Buttons are tappable
- ✅ Description preview is readable
- ✅ Layout stacks vertically if needed
- ✅ No horizontal scroll

---

### Test 19: Year Detection Patterns

**Objective**: Verify all year detection patterns work

#### Test websites with text:
- "Established in 1995" → Should detect: 1995
- "Since 1998" → Should detect: 1998
- "Founded 2000" → Should detect: 2000
- "Serving since 1985" → Should detect: 1985
- "In business since 1990" → Should detect: 1990
- "1995 - present" → Should detect: 1995
- "Over 25 years" → Should calculate: 2001 (2026-25)

#### Expected Results:
- ✅ All patterns detected correctly
- ✅ Years validated (1900-2026)
- ✅ Calculations accurate
- ✅ Invalid years rejected

---

### Test 20: Full Integration Test

**Objective**: Complete end-to-end realistic scenario

#### Steps:
1. **Setup**:
   - Fresh dealer account
   - Profile with: name, address, phone, website URL
   - Website has clear About section with year

2. **Analyze**:
   - Click "Analyze Website"
   - Wait for completion
   - Verify knowledge extracted

3. **Review Suggestions**:
   - Purple panel appears
   - Description looks accurate
   - Year is correct

4. **Apply Updates**:
   - Click "Apply Updates"
   - Verify success toast
   - Check profile updated

5. **Verify AI Context**:
   - Open DAIVE chat
   - Ask AI: "Tell me about this dealership"
   - AI should mention:
     - Business description
     - Established year
     - Information from knowledge base

6. **View Knowledge**:
   - Click "View Knowledge" button
   - Navigate to DAIVE settings
   - Verify all extracted knowledge visible

7. **Complete Workflow**:
   - All features working together
   - Professional user experience
   - No errors anywhere

#### Expected Results:
- ✅ Smooth, professional workflow
- ✅ All features integrated
- ✅ AI has enhanced context
- ✅ Profile looks complete
- ✅ User satisfied with result

---

## Performance Benchmarks

### Target Metrics:
- **Analysis Time**: 5-30 seconds (depending on website size)
- **Apply Updates**: < 2 seconds
- **UI Response**: Instant (< 100ms)
- **Database Query**: < 500ms
- **No Memory Leaks**: Check DevTools Performance tab

---

## Common Issues & Solutions

### Issue: "Analyzing..." never completes
**Solution**: 
- Check backend server running
- Verify website URL accessible
- Check browser console for errors
- Look at backend logs

### Issue: No suggestions appear
**Reason**: 
- Website may not have detectable info
- Add clear About section
- Mention established year explicitly

### Issue: Apply button does nothing
**Solution**:
- Check authentication token
- Verify permissions
- Check browser console
- Review network tab

### Issue: Wrong data extracted
**Action**:
- Click Dismiss
- Manually edit profile
- Report for improvement

---

## Testing Checklist

Copy this checklist and mark off as you test:

```
[ ] Test 1: Basic Extraction and Application
[ ] Test 2: Dismiss Suggestions
[ ] Test 3: No Suggestions Scenario
[ ] Test 4: Partial Suggestions (Year Only)
[ ] Test 5: Partial Suggestions (Description Only)
[ ] Test 6: Close Button (X)
[ ] Test 7: Multiple Analyses
[ ] Test 8: Apply After Previous Apply
[ ] Test 9: Invalid Website URL
[ ] Test 10: Empty Profile Fields
[ ] Test 11: Pre-filled Profile Fields
[ ] Test 12: Long Descriptions
[ ] Test 13: Special Characters
[ ] Test 14: Concurrent Analysis
[ ] Test 15: Permissions Check
[ ] Test 16: Network Errors
[ ] Test 17: Database Validation
[ ] Test 18: Browser Compatibility
[ ] Test 19: Mobile Responsiveness
[ ] Test 20: Year Detection Patterns
[ ] Test 21: Full Integration Test
```

---

## Success Criteria

The feature passes testing when:
- ✅ All 21 tests pass
- ✅ No errors in browser console
- ✅ No errors in backend logs
- ✅ Database data is accurate
- ✅ UI is responsive and smooth
- ✅ Error handling is graceful
- ✅ Performance is acceptable
- ✅ User experience is intuitive

---

## Bug Reporting Template

If you find issues, report with:

```
**Bug Title**: [Short description]

**Test Case**: Test #X - [Name]

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happened]

**Browser/Version**: 
[Chrome 120, Firefox 121, etc.]

**Console Errors**:
[Copy any error messages]

**Screenshots**:
[Attach if helpful]

**Database State**:
[Relevant DB queries]
```

---

## Next Steps After Testing

Once all tests pass:
1. ✅ Mark feature as production-ready
2. ✅ Document any edge cases found
3. ✅ Update user documentation if needed
4. ✅ Train support team
5. ✅ Monitor production usage
6. ✅ Collect user feedback
7. ✅ Plan enhancements

---

**Happy Testing!** 🎉

---

**Document Version**: 1.0
**Last Updated**: August 7, 2026
**Feature**: Profile Auto-Update
**Status**: Ready for Testing
