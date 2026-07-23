# 📘 DAIVE Follow-Up Automation - User Guide

## Welcome! 🎉

This guide will help you understand and use the DAIVE Follow-Up Automation System to automatically engage with your customers throughout their entire journey - from first contact to loyal repeat customer.

---

## 📋 Table of Contents

1. [What is Follow-Up Automation?](#what-is-follow-up-automation)
2. [Getting Started](#getting-started)
3. [Understanding the Settings](#understanding-the-settings)
4. [Follow-Up Categories Explained](#follow-up-categories-explained)
5. [Best Practices](#best-practices)
6. [Frequently Asked Questions](#frequently-asked-questions)
7. [Troubleshooting](#troubleshooting)

---

## What is Follow-Up Automation?

The Follow-Up Automation System is your **24/7 digital sales and service assistant**. It automatically:

- ✅ **Responds to new leads** within minutes
- ✅ **Follows up with test drive customers** who didn't buy
- ✅ **Welcomes new buyers** and keeps them engaged
- ✅ **Reminds service customers** when it's time for maintenance
- ✅ **Re-engages at-risk customers** before you lose them
- ✅ **Wins back lost customers** with special offers
- ✅ **Builds long-term loyalty** with personalized messages

**The best part?** It all happens automatically while you focus on selling cars and serving customers.

---

## Getting Started

### Step 1: Access the Settings

1. Log into your DealerIQ account
2. Click **Admin** in the top navigation
3. Select **Follow-Up Settings**

You'll see the Follow-Up Automation control panel.

---

### Step 2: Quick Start (First Time Setup)

Follow these 8 simple steps to get started:

#### 1️⃣ **Test Your Email Configuration**

- Click the **Credentials** tab
- Click **"Test Email"** button
- Enter your email address when prompted
- Check your inbox - you should receive a test email
- ✅ If you got the email, you're good to go!
- ❌ If not, check your `.env` file SMTP settings

#### 2️⃣ **Test Your SMS Configuration** (Optional but Recommended)

- Still in the **Credentials** tab
- Click **"Test SMS"** button
- Enter your phone number with country code (e.g., +12025551234)
- You should receive a test SMS
- ✅ If you got the SMS, perfect!
- ❌ If not, check your Twilio credentials in `.env`

#### 3️⃣ **Enable Communication Channels**

- Go to the **Channels** tab
- Toggle **Email** to ON (minimum requirement)
- Toggle **SMS** to ON (highly recommended)
- Toggle **WhatsApp** if you have WhatsApp Business setup
- Leave **Push Notifications** off for now (requires mobile app)

#### 4️⃣ **Choose Auto-Enrollment Categories**

- Go to the **Auto-Enrollment** tab
- **For beginners**, we recommend starting with:
  - ✅ **Lead Nurture** (new leads)
  - ✅ **Post-Purchase** (new buyers)
- **After you're comfortable**, enable:
  - ✅ **Unsold Visit** (test drives without purchase)
  - ✅ **Service Customer** (service reminders)

#### 5️⃣ **Set Your Timing Preferences**

- Go to the **Timing** tab
- **Quiet Hours Start**: Set to 9:00 PM (or your preference)
- **Quiet Hours End**: Set to 8:00 AM (or your preference)
- **Timezone**: Make sure this matches your dealership's timezone
- **Max Messages Per Day**: Leave at 5 (prevents overwhelming customers)
- **Min Delay Between Messages**: Leave at 4 hours

#### 6️⃣ **Save Your Settings**

- Click the **"Save Settings"** button at the top right
- You should see a green success message

#### 7️⃣ **Enable the Master Switch**

- At the very top of the page, you'll see the Master ON/OFF toggle
- **Toggle it to ON** 🟢
- The status will change from "System Paused" to "System Active"

#### 8️⃣ **Save Again to Activate**

- Click **"Save Settings"** one more time
- You're now LIVE! 🎉

#### 9️⃣ **Monitor the System**

- Go to the **Status** tab
- Check daily to see:
  - Active enrollments
  - Messages sent today
  - Pending messages
  - Scheduler status

---

## Understanding the Settings

### 🔌 Master ON/OFF Toggle

**Location:** Top of the page (big and obvious!)

**What it does:**
- 🟢 **ON (Green):** System actively sends automated messages
- ⚪ **OFF (Gray):** System paused, no messages sent

**When to turn it OFF:**
- During holidays when dealership is closed
- When testing new configurations
- If you notice issues and need to pause

**When to turn it ON:**
- After testing your setup
- During normal business operations
- To start automating follow-ups

---

### 📱 Channels Tab

Choose which communication channels to use:

#### 📧 **Email**
- **Best for:** Detailed information, special offers, long messages
- **Timing:** Can be longer messages, includes images and links
- **Setup:** Requires SMTP configuration in `.env` file
- **Cost:** Usually free or low-cost with your email provider
- **Open Rate:** 20-30% typical

#### 📱 **SMS (Text Messages)**
- **Best for:** Quick reminders, urgent updates, appointment confirmations
- **Timing:** Immediate delivery, short and concise
- **Setup:** Requires Twilio account and credentials in `.env`
- **Cost:** ~$0.01 per message (Twilio pricing)
- **Open Rate:** 90%+ typical

#### 💬 **WhatsApp**
- **Best for:** International customers, rich media messages
- **Timing:** Instant delivery with read receipts
- **Setup:** Requires WhatsApp Business API account
- **Cost:** Varies by region
- **Open Rate:** 70-90% typical

#### 🔔 **Push Notifications**
- **Best for:** In-app alerts for mobile app users
- **Timing:** Instant delivery
- **Setup:** Requires mobile app integration
- **Cost:** Usually free
- **Not needed for most dealers**

---

### 👥 Auto-Enrollment Tab

Choose which customer journeys trigger automatic follow-ups:

#### 🆕 **Lead Nurture** (Highly Recommended ✨)

**When it triggers:** Customer shows interest through DAIVE conversation

**What happens:**
- **Day 0 (Immediate):** Sends vehicle information and availability
- **Day 1:** Follow-up with similar vehicles and options
- **Day 3:** Special offer + test drive invitation
- **Day 7:** Financing options and pre-approval info

**Best for:** Converting new leads into showroom visitors

**Expected results:** 20-30% increase in test drive bookings

---

#### 🚗 **Unsold Visit** (Recommended for higher conversion)

**When it triggers:** Customer test drove a vehicle but didn't purchase

**What happens:**
- **Day 0 (Immediately after):** Thank you for visiting message
- **Day 1:** Follow-up addressing any concerns discussed
- **Day 3:** Alternative vehicle suggestions based on their needs
- **Day 7:** Special incentive or limited-time offer

**Best for:** Converting lost sales into deals

**Expected results:** 10-15% recovery rate on unsold visits

---

#### 🎉 **Post-Purchase** (Highly Recommended ✨)

**When it triggers:** Customer completes a vehicle purchase

**What happens:**
- **Day 0 (After purchase):** Welcome and congratulations
- **Day 3:** Check-in on satisfaction, any questions?
- **Day 7:** Mobile app download + features explanation
- **Day 30:** First service reminder + maintenance tips
- **Day 90:** Second service reminder

**Best for:** Building loyalty and generating referrals

**Expected results:** Higher satisfaction scores, more referrals, better reviews

---

#### 🔧 **Service Customer**

**When it triggers:** Based on last service date or mileage

**What happens:**
- **Every 90 days:** Service due reminder
- **1 week before appointment:** Appointment confirmation
- **Day after service:** Thank you + satisfaction survey

**Best for:** Keeping service bays full

**Expected results:** 30-40% increase in service appointments

---

#### ⚠️ **At-Risk**

**When it triggers:** Customer engagement score drops below threshold

**What happens:**
- **Week 1:** Re-engagement attempt with personal touch
- **Week 2:** Special offer tailored to their interests
- **Week 3:** Request for personal call from sales manager

**Best for:** Preventing customer loss before it happens

**Expected results:** 15-25% re-engagement rate

---

#### 💔 **Churn Prevention**

**When it triggers:** Customer hasn't engaged in 6+ months

**What happens:**
- **Month 1:** "We miss you" message with nostalgia
- **Month 2:** Substantial win-back offer
- **Month 3:** Final attempt with special VIP treatment offer

**Best for:** Winning back lost customers

**Expected results:** 5-10% win-back rate (high-value when it works!)

---

#### 💎 **Long-Term Loyalty**

**When it triggers:** Automatically for all customers over time

**What happens:**
- **Quarterly:** Check-in messages and updates
- **Holidays:** Special greetings (Christmas, New Year, etc.)
- **Purchase Anniversary:** "It's been X years!" celebration message
- **Birthdays:** Happy birthday with special offer

**Best for:** Building lifetime customer relationships

**Expected results:** Increased referrals, repeat purchases, positive reviews

---

### ⏰ Timing Tab

Control **when** messages are sent:

#### 🌙 **Quiet Hours**

**What it is:** Time window when NO messages are sent

**Default:** 9:00 PM to 8:00 AM

**Why it matters:** Respecting customer sleep time prevents complaints and maintains your reputation

**Recommended settings:**
- Residential customers: 9 PM - 8 AM
- Business customers: 8 PM - 7 AM
- Adjust based on your customer demographics

**What happens to scheduled messages:** They wait until quiet hours end, then send immediately

---

#### 🌍 **Timezone**

**What it is:** The timezone used for all timing calculations

**Critical:** MUST match your dealership's physical location

**Example:** If you're in New York, use `America/New_York`

**Why it matters:** 9 PM in California is midnight in New York. Wrong timezone = messages at wrong times = angry customers

---

#### 📊 **Max Messages Per Day**

**What it is:** Maximum messages one customer receives in 24 hours

**Default:** 5 messages

**Recommended:** 3-5 messages

**Why it matters:** Prevents message fatigue and spam complaints

**Example:** If customer is in 3 sequences and all trigger on same day, only the 5 highest-priority messages send

---

#### ⏰ **Min Delay Between Messages**

**What it is:** Minimum hours between any two messages to same customer

**Default:** 4 hours

**Recommended:** 4-6 hours

**Why it matters:** Spaces out messages so customer doesn't feel bombarded

**Example:** If message sends at 10 AM, next message won't send before 2 PM (if delay is 4 hours)

---

### 🔒 Credentials Tab

View your communication setup and test your configuration:

**What you'll see:**
- Email configuration from `.env` file
- SMS configuration from `.env` file
- WhatsApp settings (if configured)

**Test Buttons:**
- ✉️ **Test Email:** Sends sample email to address you specify
- 📱 **Test SMS:** Sends sample text to phone you specify

**⚠️ Important:** Always test BEFORE enabling the system!

---

### 📊 Status Tab

Real-time monitoring dashboard:

#### **Active Enrollments**
- **What it shows:** Number of customers currently in follow-up sequences
- **What it means:** Higher = more automated engagement happening
- **Typical range:** 50-500 depending on dealership size

#### **Messages Sent Today**
- **What it shows:** Total messages sent in last 24 hours
- **What it means:** Activity level of your automation
- **What to watch for:** Sudden drops might indicate a problem

#### **Pending Messages**
- **What it shows:** Messages scheduled to send in next 60 minutes
- **What it means:** Upcoming activity
- **What to watch for:** Always should be some pending during business hours

#### **Scheduler Status**
- **What it shows:** Whether background service is running
- **What it means:** Green = working, Red = problem
- **What to do if red:** Contact your system administrator

#### **Last Check**
- **What it shows:** Last time scheduler checked for messages to send
- **What it means:** System is actively working
- **What to watch for:** Should update every 5 minutes

---

## Best Practices

### 🎯 Starting Out

1. **Start with 2 categories:** Lead Nurture + Post-Purchase
2. **Monitor for 2 weeks:** Watch the Status tab daily
3. **Review customer feedback:** Are they responding positively?
4. **Add more categories:** Gradually enable Unsold Visit, Service, etc.
5. **Optimize timing:** Adjust quiet hours and delays based on response rates

---

### ✅ Do's

✓ **Test thoroughly** before going live  
✓ **Start conservatively** with timing (fewer messages, longer delays)  
✓ **Monitor daily** for the first month  
✓ **Read customer responses** to gauge sentiment  
✓ **Keep quiet hours enabled** always  
✓ **Use both Email and SMS** for best results  
✓ **Check Status tab** every morning  
✓ **Celebrate wins** when customers respond positively!

---

### ❌ Don'ts

✗ **Don't skip testing** - always test email and SMS first  
✗ **Don't enable all categories at once** - start small  
✗ **Don't set aggressive timing** - more messages ≠ more sales  
✗ **Don't ignore customer complaints** - pause and adjust if needed  
✗ **Don't disable quiet hours** - respect customer time  
✗ **Don't forget to save** after making changes  
✗ **Don't panic** if you see low engagement at first - it takes time  
✗ **Don't leave the system running unchecked** - monitor regularly

---

## Frequently Asked Questions

### **Q: Will my customers get annoyed by too many messages?**

**A:** No, if configured correctly. The system has built-in protections:
- Rate limits (max messages per day)
- Minimum delays between messages
- Quiet hours (no nighttime messages)
- Automatic pause for low-engagement customers
- Opt-out options in every message

**Recommendation:** Start with default settings (5 messages/day max, 4-hour delays), then adjust based on feedback.

---

### **Q: Can customers opt out?**

**A:** Yes, absolutely:
- **SMS:** Reply "STOP" to any message
- **Email:** Click "Unsubscribe" link at bottom
- **Effect:** They're immediately removed from ALL automated sequences
- **System action:** Automatically pauses their enrollments

You can also manually opt out customers in the database if needed.

---

### **Q: What happens if I turn the system off?**

**A:** 
- All scheduled messages are paused immediately
- No new enrollments happen
- Existing customer journey progress is saved
- When you turn it back on, sequences resume where they left off
- No messages are lost, just delayed

**Use case:** Turn off during major holidays, during system maintenance, or if you notice issues.

---

### **Q: How much does it cost to send messages?**

**A:** 
- **Email:** Usually free (uses your existing email)
- **SMS:** ~$0.01 per message (Twilio pricing)
- **WhatsApp:** Varies by region (~$0.01-0.05)

**Example cost:** 
- 100 customers enrolled
- Average 3 messages each over 2 weeks
- 300 messages × $0.01 = $3.00 for SMS
- Email is free
- **Total: ~$3.00 for 300 automated touchpoints**

**Compare to:** Hiring someone to manually follow up with 100 customers = hours of labor

---

### **Q: Can I customize the message templates?**

**A:** Yes, but it requires database access:
- Message templates are stored in `followup_steps` table
- You can edit the `message_template` field
- Supports variables like `{{customer_name}}`, `{{vehicle_name}}`, etc.

**Recommendation:** Contact your system administrator or developer to customize messages.

**Coming soon:** Web-based template editor (Phase 2 feature)

---

### **Q: How do I know if it's working?**

**A:** Check these indicators:
1. **Status Tab:** Shows active enrollments and messages sent
2. **Customer Responses:** You'll receive replies to emails/SMS
3. **Lead Conversion:** Track how many leads book test drives
4. **Service Appointments:** Monitor service booking increases
5. **Database Logs:** Check `followup_execution_log` table for details

**Green flags:**
- ✅ Active enrollments increasing
- ✅ Messages being sent regularly
- ✅ Customer responses are positive
- ✅ Higher test drive booking rates
- ✅ More service appointments

**Red flags:**
- ❌ No enrollments (check if categories are enabled)
- ❌ No messages sent (check if system is ON)
- ❌ Customer complaints (review timing settings)
- ❌ High opt-out rate (messages may be too frequent)

---

### **Q: What if a customer calls saying they got too many messages?**

**A:**
1. **Apologize** and thank them for the feedback
2. **Immediately opt them out** (or reduce their frequency)
3. **Review your settings:** Are your rate limits too high?
4. **Check their enrollment:** Are they in multiple sequences?
5. **Adjust if needed:** Lower max messages/day or increase delays
6. **Document the feedback:** Use it to improve

**Important:** One complaint doesn't mean the system is broken - use feedback to optimize.

---

### **Q: Can I see exactly what messages were sent to a specific customer?**

**A:** Yes, through the database:
```sql
SELECT * FROM followup_execution_log 
WHERE to_address = 'customer@example.com' 
ORDER BY sent_at DESC;
```

Shows:
- Every message sent
- When it was sent
- What channel (email/SMS)
- Whether it was opened/clicked
- Any delivery errors

**Coming soon:** Customer-specific dashboard view (Phase 2 feature)

---

### **Q: Does this work with DAIVE (the AI chatbot)?**

**A:** Yes! Integration points:
- DAIVE conversation creates lead → Enrolled in "Lead Nurture"
- DAIVE detects high interest → Enrolled with "hot_lead" priority
- DAIVE detects purchase → Enrolled in "Post-Purchase"
- DAIVE detects dissatisfaction → Enrolled in "At-Risk"

The systems work together seamlessly to nurture customers from first contact to loyal repeat buyer.

---

### **Q: What's the best configuration for a small dealership?**

**A:** Start with this:

**Categories:**
- ✅ Lead Nurture
- ✅ Post-Purchase

**Channels:**
- ✅ Email
- ✅ SMS (if budget allows)

**Timing:**
- Quiet Hours: 9 PM - 8 AM
- Max Messages/Day: 3
- Min Delay: 6 hours

**Why this works:**
- Focuses on highest-impact sequences
- Conservative timing prevents overwhelm
- Low cost (mostly email)
- Easy to monitor with smaller volume

After 4 weeks, evaluate and expand gradually.

---

### **Q: What's the best configuration for a large dealership?**

**A:** Go more aggressive:

**Categories:**
- ✅ Lead Nurture
- ✅ Unsold Visit
- ✅ Post-Purchase
- ✅ Service Customer
- ✅ At-Risk

**Channels:**
- ✅ Email
- ✅ SMS
- ✅ WhatsApp (if customer base supports it)

**Timing:**
- Quiet Hours: 9 PM - 8 AM
- Max Messages/Day: 5
- Min Delay: 4 hours

**Why this works:**
- Covers entire customer lifecycle
- Higher volume dealerships can absorb more touchpoints
- Multiple channels increase engagement
- ROI justifies the higher SMS costs

---

## Troubleshooting

### Problem: System shows "Disabled" but I want it enabled

**Solution:**
1. Toggle the Master Switch to ON (top of page)
2. Click "Save Settings"
3. Refresh the Status tab
4. Should now show "Active"

---

### Problem: Test email fails

**Possible causes:**
1. Wrong SMTP credentials in `.env`
2. SMTP server blocking connection
3. Firewall blocking port 587

**Solution:**
1. Check `.env` file has correct:
   - `SMTP_HOST`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_PORT`
2. Try testing from command line: `node send-test-followup-emails.js`
3. Check SMTP server logs
4. Contact your email provider

---

### Problem: Test SMS fails

**Possible causes:**
1. Wrong Twilio credentials
2. Twilio account not activated
3. Phone number not verified

**Solution:**
1. Check `.env` file has:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
2. Log into Twilio dashboard
3. Verify account is active and funded
4. Check phone number is verified in Twilio

---

### Problem: No messages being sent

**Check:**
1. ✅ Master switch is ON
2. ✅ At least one channel is enabled
3. ✅ At least one category is selected
4. ✅ Clicked "Save Settings" after changes
5. ✅ Status tab shows "Scheduler Running"
6. ✅ Not during quiet hours

**If all above are correct:**
- Check `followup_enrollments` table - are there active enrollments?
- Check `followup_execution_log` table - any recent entries?
- Check server logs for errors

---

### Problem: Messages sending at wrong times

**Cause:** Timezone mismatch

**Solution:**
1. Go to Timing tab
2. Verify timezone matches your dealership location
3. Save settings
4. Wait for next scheduled message

---

### Problem: Customers complaining about too many messages

**Immediate action:**
1. Apologize to customer
2. Manually opt them out
3. Review your settings

**Long-term fix:**
1. Reduce "Max Messages Per Day" to 3
2. Increase "Min Delay Between Messages" to 6 hours
3. Review which categories are enabled - maybe disable some
4. Monitor for a week

---

### Problem: Status shows 0 active enrollments

**Possible causes:**
1. System recently enabled - give it time
2. No customers meeting enrollment criteria
3. Auto-enrollment disabled

**Solution:**
1. Check Auto-Enrollment tab - at least one category enabled?
2. Create a test lead through DAIVE
3. Check `customer_lifecycle_stages` table for entries
4. Check database for enrollment triggers

---

## Need More Help?

### Documentation Files:
- `FOLLOWUP_IMPLEMENTATION_TRACKER.md` - Technical implementation details
- `FOLLOWUP_TROUBLESHOOTING.md` - Advanced troubleshooting
- `FOLLOWUP_SYSTEM_SUCCESS.md` - System overview and testing
- `Daive Followup.md` - Original requirements document

### Database Access:
If you need to check database directly:
```sql
-- See all active enrollments
SELECT * FROM followup_enrollments WHERE status = 'active';

-- See messages sent today
SELECT * FROM followup_execution_log 
WHERE DATE(sent_at) = CURRENT_DATE;

-- See all rule templates
SELECT * FROM followup_rule_templates WHERE is_active = true;
```

### Support:
Contact your system administrator or DealerIQ support team.

---

## 🎉 Congratulations!

You now have a powerful, automated customer engagement system working 24/7 to:
- Convert more leads
- Recover unsold visits
- Delight new buyers
- Fill your service bays
- Win back lost customers
- Build lifetime loyalty

**The system never sleeps, never forgets, and never misses a follow-up!**

---

*Last Updated: November 2024*  
*Version: 1.0*  
*DAIVE Follow-Up Automation System*

