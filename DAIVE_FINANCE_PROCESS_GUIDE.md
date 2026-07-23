# 🚗💰 DAIVE Finance Process - Complete Help Guide

## Overview

This guide walks you through the complete finance and lease process in DAIVE CRM, from initial customer conversation to deal finalization. The DAIVE AI bot intelligently guides customers through financing discussions while automatically collecting required information and generating deal sheets.

---

## 📋 Table of Contents

1. [Finance in the DAIVE Journey](#finance-in-the-daive-journey)
2. [Step 12: Finance Finalization](#step-12-finance-finalization)
3. [Credit Application Process](#credit-application-process)
4. [Finance vs Lease: Understanding the Options](#finance-vs-lease)
5. [Credit Tiers & Scoring](#credit-tiers--scoring)
6. [Deal Sheet Generation](#deal-sheet-generation)
7. [Lender Management](#lender-management)
8. [Common Scenarios & Best Practices](#common-scenarios--best-practices)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Finance in the DAIVE Journey

### The 16-Step Client Journey

The DAIVE system follows a comprehensive 16-step client journey. Finance discussions occur at **Step 12: Finance Finalization** after the customer has:

**Pre-Finance Steps (Steps 1-11):**
1. ✅ Been greeted and qualified
2. ✅ Identified their preferred vehicle type
3. ✅ Defined their budget range
4. ✅ Selected desired features
5. ✅ Checked preferred brands
6. ✅ Received vehicle recommendations
7. ✅ Completed test drive (optional)
8. ✅ Made purchase decision
9. ✅ Confirmed sale details
10. ✅ Reviewed contract terms
11. ✅ Discussed trade-in (optional)

**Finance Step:**
12. 💰 **Finance Finalization** - The DAIVE bot transitions to finance specialist mode

**Post-Finance Steps (Steps 13-16):**
13. Vehicle preparation
14. Delivery & handover
15. CSI & follow-ups
16. Long-term relationship

---

## 💰 Step 12: Finance Finalization

### What Happens in Step 12?

When DAIVE reaches Step 12, the bot automatically:

1. **Switches to Finance Specialist Agent** - The conversation tone changes to focus on financing
2. **Asks About Payment Method** - Finance, Lease, or Cash purchase
3. **Collects Credit Information** - Credit score estimation
4. **Gathers Down Payment Details** - How much customer can put down
5. **Calculates Payment Options** - Real-time payment calculations
6. **Creates Credit Application** - Generates secure credit application link
7. **Sends Email to Customer** - Credit application link via email
8. **Generates Deal Sheet** - Creates PDF deal sheet for review

### DAIVE Conversation Flow in Step 12

```
DAIVE: "Perfect! Now let's discuss financing options for your [Vehicle]. 
        Would you prefer to finance, lease, or purchase with cash?"

Customer: "I'd like to finance it"

DAIVE: "Great choice! To give you the most accurate rates, may I ask 
        what your estimated credit score is? (Excellent: 750+, Good: 700-749, 
        Fair: 650-699, or Poor: Below 650)"

Customer: "Around 720"

DAIVE: "Excellent! With a credit score around 720, you qualify for our 
        good-credit tier with competitive rates. How much would you like 
        to put down as a down payment?"

Customer: "$5,000"

DAIVE: "Perfect! Based on:
        - Vehicle Price: $35,000
        - Down Payment: $5,000
        - Credit Tier: Good (700-749)
        - Estimated APR: 6.5%
        
        Your estimated monthly payment would be approximately $582/month 
        for 60 months.
        
        I'm creating a credit application for you now. You'll receive an 
        email with a secure link to complete your application. Would you 
        like me to send that now?"

Customer: "Yes, please"

DAIVE: "✅ Done! I've sent the credit application link to your email. 
        Once you complete it, our finance team will review and finalize 
        your deal sheet within 24 hours."
```

### Information Collected Automatically

During Step 12, DAIVE collects and stores:

| Data Point | Where It's Stored | Purpose |
|------------|------------------|---------|
| Payment Method | `Daivesteps[12].slots.finance.preferred_method` | Finance/Lease/Cash |
| Credit Score | `Daivesteps[12].slots.finance.credit_score` | Determine tier & rate |
| Down Payment | `Daivesteps[12].slots.finance.down_payment` | Calculate monthly payment |
| Lease Term | `Daivesteps[12].slots.finance.lease_term` | For lease calculations |
| Monthly Budget | `Daivesteps[12].slots.finance.monthly_budget` | Validate affordability |

---

## 📝 Credit Application Process

### Step-by-Step: How Credit Applications Work

#### 1. **Customer Expresses Interest in Financing**
- During DAIVE conversation (Step 12)
- Customer selects "Finance" or "Lease" as payment method

#### 2. **DAIVE Collects Basic Information**
- Estimated credit score
- Down payment amount
- Preferred term (36, 48, 60, 72 months)
- Monthly budget (optional)

#### 3. **Credit Application Created Automatically**
- DAIVE calls `/api/finance/credit-application` endpoint
- Creates database record in `credit_applications` table
- Links to vehicle and conversation
- Status: "pending"

#### 4. **Secure Email Sent to Customer**
- Email contains unique credit application link
- Link format: `https://yourcrm.com/#/credit-application/{uuid}`
- Customer clicks link to fill out full application

#### 5. **Customer Completes Full Application**
- Personal information (name, email, phone)
- Social Security Number (encrypted)
- Driver's License Number (encrypted)
- Employment information
- Income verification
- Co-applicant details (optional)

#### 6. **Application Submitted**
- Data encrypted before storage (AES-256)
- Email notification sent to dealer finance team
- Status changes to "submitted"

#### 7. **Finance Manager Reviews**
- Access via CRM → Finance → Credit Applications tab
- Review customer information
- Run credit check through integrated service (if available)
- Verify income and employment

#### 8. **Lender Submission (Optional)**
- Submit to one or multiple lenders
- Track submission status
- Receive approval/rejection/counter-offers
- Compare lender offers

#### 9. **Application Approved/Rejected**
- Update status to "approved" or "rejected"
- Customer receives email notification
- If approved, proceed to deal sheet generation

#### 10. **Deal Sheet Finalized**
- Generate official deal sheet PDF
- Send for e-signature (DocuSign integration)
- Track signature status
- Complete financing paperwork

---

## 🏦 Finance vs Lease: Understanding the Options

### Finance (Auto Loan)

**How It Works:**
- Customer borrows money to purchase the vehicle
- Makes monthly payments (principal + interest)
- Owns the vehicle at the end of the loan term
- Can sell or trade-in at any time

**Key Terms:**
- **APR (Annual Percentage Rate)**: Interest rate charged on the loan
- **Term**: Length of loan (36, 48, 60, 72 months typical)
- **Down Payment**: Initial payment (10-20% recommended)
- **Total Amount Financed**: Vehicle price - down payment + fees

**Monthly Payment Formula:**
```
Monthly Payment = P × (r × (1 + r)^n) / ((1 + r)^n - 1)

Where:
P = Principal (amount financed)
r = Monthly interest rate (APR / 12 / 100)
n = Number of months (term)
```

**Example:**
```
Vehicle Price: $35,000
Down Payment: $5,000
Amount Financed: $30,000
APR: 6.5%
Term: 60 months

Monthly Payment: $587.13
Total Interest Paid: $5,227.80
Total Cost: $35,227.80
```

**Best For:**
- Customers who want to own the vehicle
- High-mileage drivers
- Long-term vehicle owners
- Those who customize their vehicles

---

### Lease

**How It Works:**
- Customer pays to use the vehicle for a set period
- Makes monthly payments (depreciation + finance charge)
- Returns vehicle at lease end (or can purchase)
- Typically 24, 36, or 39 month terms

**Key Terms:**
- **Money Factor**: Lease equivalent of APR (Money Factor × 2400 = APR)
- **Residual Value**: Expected vehicle value at lease end
- **Cap Cost**: Capitalized cost (vehicle price - down payment)
- **Mileage Limit**: Annual mileage allowance (10k, 12k, 15k typical)

**Monthly Payment Formula:**
```
Depreciation Fee = (Cap Cost - Residual Value) / Term
Finance Charge = (Cap Cost + Residual Value) × Money Factor
Monthly Payment = Depreciation Fee + Finance Charge
```

**Example:**
```
Vehicle Price (MSRP): $35,000
Cap Cost: $35,000
Down Payment: $2,000
Net Cap Cost: $33,000
Residual Value (60%): $21,000
Money Factor: 0.00167 (4% APR)
Term: 36 months

Depreciation Fee: ($33,000 - $21,000) / 36 = $333.33
Finance Charge: ($33,000 + $21,000) × 0.00167 = $90.18
Monthly Payment: $423.51
```

**Best For:**
- Customers who want lower monthly payments
- Those who prefer new vehicles every 2-3 years
- Lower-mileage drivers (under 15k miles/year)
- Business use (potential tax benefits)

---

### Finance vs Lease Comparison

| Factor | Finance | Lease |
|--------|---------|-------|
| **Ownership** | You own the vehicle | Dealer owns, you rent |
| **Monthly Payment** | Higher | Lower (typically 30-40% less) |
| **Down Payment** | 10-20% recommended | Lower (0-10%) |
| **Mileage Limits** | Unlimited | 10-15k miles/year |
| **Wear & Tear** | Your responsibility | Charges for excess wear |
| **Customization** | Fully allowed | Not allowed |
| **Early Termination** | Can sell anytime | Costly penalties |
| **End of Term** | You own it | Return or buy out |
| **Equity** | Build equity | No equity |
| **Credit Requirements** | Flexible | Usually requires good credit |

---

## 📊 Credit Tiers & Scoring

### U.S. Credit Score Ranges

The DAIVE system uses standard U.S. credit tiers based on FICO scores:

| Tier | Score Range | Label | Typical APR | Money Factor | Description |
|------|-------------|-------|-------------|--------------|-------------|
| **Tier 1** | 750+ | Excellent | 2.9% - 5.9% | 0.0010 - 0.0015 | Best rates, lowest risk |
| **Tier 2** | 700-749 | Good | 6.0% - 8.5% | 0.0016 - 0.0020 | Competitive rates |
| **Tier 3** | 650-699 | Fair | 8.6% - 11.9% | 0.0021 - 0.0027 | Moderate rates |
| **Tier 4** | 600-649 | Poor | 12% - 17% | 0.0028 - 0.0035 | Higher rates |
| **Tier 5** | Below 600 | Subprime | 18% - 25% | 0.0036+ | Subprime lenders |

### How DAIVE Determines Credit Tier

1. **Customer Self-Reports** (Step 12)
   - DAIVE asks: "What's your estimated credit score?"
   - Customer provides: "Around 720"
   - DAIVE maps to Tier 2 (Good)

2. **Automatic Tier Calculation**
   ```javascript
   function getCreditTier(creditScore) {
     if (creditScore >= 750) return { tier: 1, label: 'Excellent' };
     if (creditScore >= 700) return { tier: 2, label: 'Good' };
     if (creditScore >= 650) return { tier: 3, label: 'Fair' };
     if (creditScore >= 600) return { tier: 4, label: 'Poor' };
     return { tier: 5, label: 'Subprime' };
   }
   ```

3. **Finance Program Matching**
   - System queries `finance_terms_master` table
   - Filters by: `tier_min_score <= credit_score <= tier_max_score`
   - Returns applicable programs for customer's tier

4. **Rate Assignment**
   - Finance programs have predefined rates per tier
   - Dealer-specific programs take precedence
   - Global/OEM programs serve as fallback

---

## 📄 Deal Sheet Generation

### What is a Deal Sheet?

A Deal Sheet is a comprehensive PDF document that summarizes all financing terms, vehicle details, and payment breakdown. It serves as:

- Official quote for customer review
- Reference for finance manager
- Document for lender submission
- Record for dealership files

### Deal Sheet Components

#### 1. **Header Section**
- Dealership logo and information
- Deal sheet ID and date
- Customer name and contact info
- Deal type badge (Finance/Lease)

#### 2. **Vehicle Information**
- Year, Make, Model, Trim
- VIN (Vehicle Identification Number)
- Stock Number
- Mileage and condition
- Vehicle photo (if available)
- MSRP and selling price

#### 3. **Customer Information**
- Full name
- Email and phone
- Credit score (tier only, not exact score)
- Credit application ID (if applicable)

#### 4. **Financing Terms** (for Finance deals)
- Vehicle price
- Down payment
- Amount financed
- APR (Annual Percentage Rate)
- Term (number of months)
- Monthly payment
- Total interest
- Total amount to be paid

#### 5. **Lease Terms** (for Lease deals)
- MSRP (Manufacturer Suggested Retail Price)
- Cap cost (Capitalized Cost)
- Down payment / Cap reduction
- Residual value and percentage
- Money factor
- Term (lease months)
- Monthly payment
- Total lease payments
- Mileage allowance
- Excess mileage charge
- Disposition fee

#### 6. **Payment Breakdown**
- Base payment
- Sales tax
- Registration fees
- Documentation fees
- Total monthly payment

#### 7. **Additional Information**
- Insurance requirements
- Gap insurance recommendation
- Extended warranty options
- Trade-in credit (if applicable)
- Rebates and incentives applied

#### 8. **Important Disclosures**
- APR details and how it's calculated
- Late payment policies
- Early payoff information
- Lease-end options (for leases)
- Credit approval contingencies

#### 9. **Footer**
- Deal sheet generated date/time
- Finance manager name (if assigned)
- Dealership contact information
- Legal disclaimers

---

### Deal Sheet Generation Workflow

```
Step 1: Customer completes credit application
   ↓
Step 2: Finance manager reviews and approves
   ↓
Step 3: System matches customer to finance program
   ↓
Step 4: Payment calculations performed
   ↓
Step 5: Deal record created in database
   ↓
Step 6: PDF generated using deal template
   ↓
Step 7: PDF saved to server (/uploads/deal-sheets/)
   ↓
Step 8: Deal sheet sent to customer email
   ↓
Step 9: E-signature request sent (DocuSign)
   ↓
Step 10: Signed document returned and filed
```

---

### How to Generate a Deal Sheet

#### Method 1: Automatic (from DAIVE Conversation)

1. Customer reaches Step 12 in DAIVE conversation
2. Provides credit score, down payment, term preference
3. Completes credit application via email link
4. DAIVE automatically generates deal sheet
5. Deal sheet appears in Finance → Deals tab

#### Method 2: Manual (from Finance Dashboard)

1. Navigate to **Finance → Deals**
2. Click **"Create New Deal"** button
3. Fill out deal form:
   - Select vehicle from inventory
   - Select customer or enter details
   - Choose Finance or Lease
   - Enter credit score
   - Enter down payment
   - Select term length
   - Choose finance program (auto-selected by tier)
4. Click **"Calculate Payment"**
5. Review calculated monthly payment
6. Click **"Generate Deal Sheet"**
7. System creates PDF and saves to database
8. Send deal sheet to customer via email

#### Method 3: Regenerate Existing Deal

1. Go to **Finance → Deals**
2. Find existing deal in table
3. Click on deal to view details
4. Click **"Regenerate Deal Sheet"**
5. New PDF generated with updated information
6. Previous versions archived automatically

---

### Deal Sheet Actions

Once a deal sheet is generated, you can:

- **👁️ View**: Open PDF in browser
- **📥 Download**: Save PDF to local computer
- **📧 Email**: Send to customer
- **✍️ Send for Signature**: Initiate DocuSign e-signature
- **✏️ Edit**: Modify deal terms and regenerate
- **📋 Duplicate**: Create a new deal based on this one
- **🗑️ Delete**: Remove deal (soft delete, archived)

---

## 🏦 Lender Management

### Managing Finance Programs

Finance programs define the rates and terms available to customers based on their credit tier.

#### Types of Programs

1. **Dealer-Specific Programs**
   - Custom programs created by your dealership
   - Take precedence over global programs
   - Can offer competitive rates for special promotions

2. **Global/OEM Programs**
   - Manufacturer incentive programs
   - Bank partnerships (Chase, Wells Fargo, etc.)
   - Credit Union partnerships
   - Serve as fallback when no dealer program matches

3. **In-House Financing**
   - "Buy Here, Pay Here" (BHPH) programs
   - For subprime customers
   - Dealership holds the note

---

### Creating a Finance Program

**Navigate to:** Finance → Finance Programs → Create Program

**Required Fields:**

1. **Program Name**: e.g., "Honda 60-Month Tier 1 Finance"
2. **Type**: Finance or Lease
3. **Term (Months)**: 24, 36, 48, 60, 72, etc.
4. **Credit Tier**:
   - Minimum Credit Score
   - Maximum Credit Score
5. **For Finance:**
   - Interest Rate (APR) in percentage
6. **For Lease:**
   - Money Factor (decimal, e.g., 0.00167)
   - Residual Value Percentage (e.g., 60% for 36-month)
7. **Program Source**:
   - OEM (Manufacturer)
   - Bank
   - Credit Union
   - In-House
8. **Down Payment Minimum**: Optional, e.g., $2,000
9. **Effective Date**: When program starts
10. **Expiry Date**: When program ends (optional)
11. **Active Status**: Enable/disable program

**Example Finance Program:**
```
Program Name: Chase Auto Finance - Good Credit 60mo
Type: Finance
Term: 60 months
Tier Min Score: 700
Tier Max Score: 749
Interest Rate: 6.5%
Program Source: Bank
Down Payment Min: $0
Active: Yes
```

**Example Lease Program:**
```
Program Name: Toyota Financial Services 36mo Lease
Type: Lease
Term: 36 months
Tier Min Score: 750
Tier Max Score: 850
Money Factor: 0.00125 (3% APR equivalent)
Residual Value: 60%
Program Source: OEM
Down Payment Min: $0
Active: Yes
```

---

### Managing Lenders

**Navigate to:** Finance → Lenders

Lenders are the financial institutions that provide funding for deals. You can manage:

#### Lender Information
- Lender name
- Lender type (Bank, Credit Union, OEM, BHPH)
- Contact person
- Phone and email
- Portal URL (for online submissions)
- API credentials (if integrated)

#### Lender Submissions

Track when you submit credit applications to lenders:

| Submission Field | Description |
|-----------------|-------------|
| **Submission Status** | Pending, Submitted, Approved, Rejected, Countered |
| **Submission Date** | When you sent the application |
| **Response Date** | When lender responded |
| **Approved Amount** | How much lender approved |
| **Approved APR** | What rate lender offered |
| **Approved Term** | What term lender offered |
| **Counter Offer** | Alternative terms proposed by lender |
| **Rejection Reason** | Why application was denied |
| **Lender Reference #** | Lender's tracking number |
| **Notes** | Additional comments |

#### Multi-Lender Submission Workflow

1. **Credit Application Approved**
   - Application status = "approved" in CRM

2. **Select Lenders to Submit**
   - Go to Finance → Credit Applications
   - Click on application
   - Click "Submit to Lenders"
   - Select one or more lenders (shotgun approach)

3. **Track Responses**
   - Each submission tracked separately
   - Update status as responses come in
   - Compare lender offers side-by-side

4. **Select Best Offer**
   - Review all approved offers
   - Choose best rate/term for customer
   - Mark selected lender as "Approved Lender"

5. **Generate Final Deal Sheet**
   - Create deal with approved lender's terms
   - Send final deal sheet to customer
   - Proceed to document signing

---

## 💡 Common Scenarios & Best Practices

### Scenario 1: Customer with Excellent Credit (750+)

**What Happens:**
- DAIVE identifies Tier 1 customer
- Offers best available rates (2.9%-5.9% APR)
- Lower down payment requirements
- Approves higher loan amounts

**Best Practices:**
- Offer extended terms (72 months) to showcase flexibility
- Present lease options with lowest money factors
- Highlight premium vehicles in inventory
- Fast-track approval process
- Offer pre-approval for future purchases

**DAIVE Response Example:**
> "Excellent! With your outstanding credit score of 780, you qualify for our top-tier financing at just 3.9% APR. This means lower monthly payments and more purchasing power. Would you like to see rates for different term lengths?"

---

### Scenario 2: Customer with Fair Credit (650-699)

**What Happens:**
- DAIVE identifies Tier 3 customer
- Offers moderate rates (8.6%-11.9% APR)
- May require higher down payment (15-20%)
- Shorter terms preferred (48-60 months)

**Best Practices:**
- Be transparent about rates and requirements
- Recommend credit improvement strategies
- Offer co-signer option
- Focus on affordable vehicles
- Build relationship for future refinancing

**DAIVE Response Example:**
> "Thank you for sharing that information. With your credit score of 670, I can offer competitive financing at 9.5% APR for 60 months. To get the best rate, I'd recommend a down payment of around $4,000. This vehicle is perfect for rebuilding credit while enjoying reliable transportation."

---

### Scenario 3: Customer with Subprime Credit (Below 600)

**What Happens:**
- DAIVE identifies Tier 5 customer
- Higher rates (18%-25% APR)
- Requires significant down payment (20-30%)
- May need subprime/BHPH lenders

**Best Practices:**
- Offer in-house financing if available
- Focus on payment affordability, not just rate
- Recommend credit-rebuilding vehicles
- Be empathetic and solution-focused
- Explain credit improvement benefits

**DAIVE Response Example:**
> "I appreciate your honesty. We work with several lenders who specialize in helping customers in your situation. With a down payment of $5,000, I can get you approved for this reliable [Vehicle] with a payment around $450/month. As you make on-time payments, your credit will improve, and you can refinance for a better rate in 12-18 months."

---

### Scenario 4: Customer Wants to Lease

**What Happens:**
- DAIVE switches to lease calculations
- Explains lease terms and mileage limits
- Calculates lower monthly payment
- Creates lease-specific deal sheet

**Best Practices:**
- Ask about annual mileage needs
- Explain wear-and-tear policies
- Discuss lease-end options (return, buy, trade)
- Calculate cost of excess mileage
- Offer multiple term options (24, 36, 39 months)

**DAIVE Response Example:**
> "Leasing is a great option for you! For this [Vehicle], your monthly payment would be approximately $389/month for 36 months with $2,500 down. The lease includes 12,000 miles per year. Would you like to see higher mileage options, or does this work for your driving needs?"

---

### Scenario 5: Customer Buying Cash

**What Happens:**
- DAIVE records cash purchase
- No finance calculations needed
- May still offer extended warranty/GAP
- Streamlined closing process

**Best Practices:**
- Confirm payment method (wire, check, etc.)
- Process quickly (no lender delays)
- Offer insurance/warranty products
- Build relationship for service/future purchases
- Ask for referrals

**DAIVE Response Example:**
> "Congratulations on paying cash for your new [Vehicle]! We'll prepare the paperwork for a quick closing. While you don't need financing, I'd like to offer some protection products that many cash buyers find valuable, like extended warranty and tire protection. May I provide details on those?"

---

### Scenario 6: Trade-In with Negative Equity

**What Happens:**
- Trade-in value less than remaining loan balance
- Negative equity must be rolled into new loan
- Increases amount financed
- May affect monthly payment significantly

**Best Practices:**
- Be transparent about negative equity
- Calculate total amount financed accurately
- Offer larger down payment to offset
- Recommend shorter term to build equity faster
- Show total cost comparison

**DAIVE Response Example:**
> "I see your trade-in is worth $8,000, but you still owe $12,000 on it. That's a $4,000 difference we'll need to add to your new loan. With your down payment of $3,000, we're financing $34,000 total. Your monthly payment will be $625/month for 60 months. Alternatively, if you increase your down payment to $7,000, we can get that closer to $550/month."

---

### Scenario 7: Co-Signer or Co-Applicant

**What Happens:**
- Customer's credit insufficient alone
- Adding co-signer improves approval odds
- Co-signer's credit determines rate
- Both parties equally responsible

**Best Practices:**
- Explain co-signer responsibilities clearly
- Collect co-signer information upfront
- Run dual credit applications
- Use better credit score for rate
- Ensure both parties understand obligations

**DAIVE Response Example:**
> "To help you get approved for this [Vehicle], I'd recommend adding a co-signer with good credit. This would significantly improve your rate and monthly payment. Would you have a family member or friend who might be willing to co-sign? They won't need to be here today; we can add them through our online application."

---

## 🔧 Troubleshooting

### Issue: Customer Not Receiving Credit Application Email

**Possible Causes:**
- Email in spam/junk folder
- Incorrect email address
- Email service not configured
- Email server errors

**Solutions:**
1. Check spam folder first
2. Verify email address in conversation history
3. Resend credit application email from CRM:
   - Go to Finance → Credit Applications
   - Find application record
   - Click "Resend Email" button
4. Provide manual link:
   - Copy application link from CRM
   - Send via SMS or alternative email
5. Check email configuration:
   - Navigate to Settings → Email Settings
   - Verify SMTP credentials
   - Test email send function

---

### Issue: Payment Calculations Seem Incorrect

**Possible Causes:**
- Missing finance program for customer's tier
- Incorrect APR or money factor
- Vehicle price not updated
- Fees not included

**Solutions:**
1. Verify finance program exists:
   - Go to Finance → Finance Programs
   - Check active programs for customer's credit tier
   - Ensure term length matches (e.g., 60 months)
2. Recalculate manually:
   ```
   Principal = Vehicle Price - Down Payment
   Monthly Rate = APR / 12 / 100
   Months = Term
   Payment = Principal × (Monthly Rate × (1 + Monthly Rate)^Months) / ((1 + Monthly Rate)^Months - 1)
   ```
3. Check vehicle price:
   - Go to Vehicles → find vehicle
   - Verify price field is accurate
4. Regenerate deal sheet with updated information

---

### Issue: Deal Sheet PDF Not Generating

**Possible Causes:**
- Missing required deal information
- PDF service not running
- File permission issues
- Template errors

**Solutions:**
1. Verify all required fields present:
   - Vehicle ID
   - Customer information
   - Finance terms (APR, term, down payment)
   - Monthly payment calculated
2. Check PDF service status:
   - Navigate to Settings → System Health
   - Verify PDF Generator is running
3. Check uploads directory permissions:
   - Ensure `/uploads/deal-sheets/` exists
   - Verify write permissions
4. View error logs:
   - Settings → System Logs
   - Filter by "PDF Generation" errors
5. Regenerate manually:
   - Edit deal record
   - Click "Force Regenerate PDF"

---

### Issue: DAIVE Not Progressing to Step 12

**Possible Causes:**
- Previous steps not completed
- Purchase decision not confirmed
- Journey tracking stuck
- Missing required slots

**Solutions:**
1. Check journey progress:
   - Go to DAIVE → Conversations
   - View conversation details
   - Check which step is current
2. Review completion criteria:
   - Steps 1-11 must be completed
   - Step 8 (Purchase Decision) is critical
   - Ensure customer confirmed intent to buy
3. Manual step progression:
   - In conversation view
   - Click "Advance to Step 12" (admin only)
4. Restart finance discussion:
   - In conversation, type: "I'd like to discuss financing"
   - DAIVE should detect intent and jump to Step 12

---

### Issue: Customer Can't Access Credit Application Link

**Possible Causes:**
- Link expired (24-48 hour timeout)
- Application already submitted
- Browser compatibility
- Link malformed

**Solutions:**
1. Generate new link:
   - Finance → Credit Applications
   - Find application
   - Click "Regenerate Link"
   - Send new link to customer
2. Check application status:
   - If status = "submitted", customer already completed it
   - Show customer status page instead
3. Test link:
   - Copy link and test in incognito browser
   - Verify it loads correctly
4. Use short link service:
   - Some email clients break long URLs
   - Use bit.ly or similar to shorten link

---

### Issue: Finance Programs Not Showing for Customer

**Possible Causes:**
- No programs match customer's credit tier
- All programs expired or inactive
- Credit score out of range
- Term length not available

**Solutions:**
1. Check available programs:
   - Finance → Finance Programs
   - Filter by customer's tier range (e.g., 700-749)
   - Verify active status = true
2. Create missing program:
   - Click "Create Program"
   - Set appropriate tier ranges
   - Add multiple term options (36, 48, 60, 72 months)
3. Use global fallback:
   - If no dealer-specific program exists
   - System should show global programs
   - Verify global programs configured
4. Adjust credit score:
   - If customer provided estimate, may be inaccurate
   - Run actual credit report
   - Update credit application with real score

---

### Issue: E-Signature Not Working

**Possible Causes:**
- DocuSign not configured
- API credentials expired
- Recipient email invalid
- Document not uploaded

**Solutions:**
1. Check DocuSign configuration:
   - Settings → Integrations → DocuSign
   - Verify API credentials
   - Test connection
2. Regenerate deal sheet:
   - Ensure PDF exists before sending for signature
   - Download PDF to verify it's valid
3. Verify recipient email:
   - Check customer email in CRM
   - Ensure no typos
4. Manual alternative:
   - Download deal sheet PDF
   - Email manually to customer
   - Request wet signature
   - Upload signed copy to CRM

---

## 📞 Support & Additional Resources

### Internal Resources

- **Finance Manager Training**: Contact your dealership's finance director
- **DAIVE Admin Guide**: See `DAIVE_ADMIN_GUIDE.md`
- **API Documentation**: See `API_DOCUMENTATION.md`
- **Video Tutorials**: Available in Settings → Help Center

### System Settings

Important settings for finance module:

- **Settings → Finance**
  - Default down payment percentage
  - Maximum loan term
  - Default APR by tier
  - Dealer fees and taxes
  
- **Settings → Email**
  - Credit application email template
  - Deal sheet email template
  - E-signature reminder settings

- **Settings → Integrations**
  - DocuSign API (e-signatures)
  - Credit reporting services
  - Lender portals (RouteOne, Dealertrack)

### Best Practices Summary

✅ **DO:**
- Always verify customer email before sending credit application
- Explain credit tiers and rates transparently
- Offer multiple financing options (different terms/down payments)
- Follow up on pending credit applications within 24 hours
- Keep finance programs updated with current market rates
- Review deal sheets before sending to customers
- Track lender submissions and responses systematically

❌ **DON'T:**
- Promise specific rates without knowing credit score
- Skip steps in the DAIVE journey
- Modify deal sheets after customer has reviewed them (without notification)
- Store unencrypted SSN or DL numbers
- Share exact credit scores with customers (use tier labels)
- Let credit applications expire without follow-up
- Forget to send deal confirmation emails

---

## 🎓 Finance Process Quick Reference

### For Sales Staff

```
1. Let DAIVE guide customer to Step 12
2. DAIVE collects: payment method, credit score, down payment
3. Credit application email sent automatically
4. Follow up if customer doesn't complete application in 24 hours
5. Once submitted, notify finance manager
6. Hand off to finance team for approval and closing
```

### For Finance Managers

```
1. Monitor Credit Applications tab for new submissions
2. Review application details
3. Run credit report (if needed)
4. Select appropriate finance program
5. Generate or review auto-generated deal sheet
6. Submit to lenders if needed
7. Approve final deal
8. Send deal sheet for e-signature
9. Complete paperwork and close deal
10. Update status to "completed"
```

### For Inventory Staff

```
1. Keep vehicle prices updated in inventory
2. Mark vehicles as "sold pending finance" when deal created
3. Prepare vehicle when deal is approved
4. Ensure vehicle ready before delivery date
5. Update status to "delivered" after handoff
```

---

## 📊 Finance Module Features At-A-Glance

| Feature | Description | User Role |
|---------|-------------|-----------|
| **Credit Applications** | Collect and manage customer credit applications | Finance Manager |
| **Finance Programs** | Define tier-based rates and terms | Finance Manager, Admin |
| **Deal Sheets** | Generate professional finance/lease quotes | Finance Manager, Sales |
| **Lender Management** | Track lenders and submission statuses | Finance Manager |
| **Payment Calculator** | Calculate finance and lease payments in real-time | Sales, Finance |
| **E-Signatures** | Send deal sheets for electronic signature | Finance Manager |
| **Multi-Lender Submit** | Submit to multiple lenders simultaneously | Finance Manager |
| **DAIVE Integration** | Automated finance collection in conversations | Automatic (DAIVE) |
| **Encryption** | Secure SSN and DL storage (AES-256) | System (Automatic) |
| **Email Notifications** | Automated customer and dealer notifications | System (Automatic) |

---

## 🚀 Getting Started Checklist

Before using the finance module, ensure:

- [ ] Finance programs created for all credit tiers
- [ ] Email service configured (SMTP settings)
- [ ] Lender accounts added (if using lender submissions)
- [ ] DocuSign integrated (for e-signatures, optional)
- [ ] Encryption key configured (for SSN/DL security)
- [ ] Staff permissions assigned correctly
- [ ] DAIVE Step 12 enabled in settings
- [ ] Credit application email template customized
- [ ] Deal sheet email template customized
- [ ] Dealer fees and taxes configured in settings
- [ ] Test credit application flow completed
- [ ] Test deal sheet generation completed

---

## 📝 Glossary

- **APR**: Annual Percentage Rate - the yearly interest rate on a loan
- **Cap Cost**: Capitalized Cost - the negotiated price of the vehicle in a lease
- **Money Factor**: The interest rate equivalent in a lease (multiply by 2400 to get APR)
- **Residual Value**: Expected value of vehicle at lease end
- **Credit Tier**: Classification of borrowers by credit score range
- **Down Payment**: Initial payment made at deal signing
- **Term**: Length of loan or lease in months
- **Deal Sheet**: Comprehensive document outlining all finance/lease terms
- **Finance Deal**: Auto loan where customer owns vehicle at end
- **Lease Deal**: Vehicle rental with option to purchase at end
- **Negative Equity**: When trade-in value is less than amount owed
- **Co-Signer**: Additional person who shares loan responsibility
- **Subprime**: Borrowers with credit scores below 600
- **BHPH**: Buy Here Pay Here - in-house financing

---

**Last Updated**: November 2024  
**Version**: 2.0  
**Maintained By**: DAIVE Finance Team

---

For technical support or feature requests, contact your system administrator or refer to the DAIVE documentation portal.

