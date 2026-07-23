# Lease Residual Implementation Guide

## 📋 Overview

This document explains the comprehensive lease residual calculation system implemented in DealerIQ. The system allows customers to submit credit applications for vehicle leases with real-time payment calculations based on industry-standard lease formulas.

---

## 🎯 What is a Lease Residual?

A **lease residual** is the estimated value of a vehicle at the end of the lease term. It's calculated as a percentage of the Manufacturer's Suggested Retail Price (MSRP) and is a key factor in determining monthly lease payments.

### Key Concept:
- **Higher residual = Lower monthly payment**
- You're paying for the vehicle's depreciation, not its full value
- The residual value becomes your buyout price at lease end

---

## 📐 Lease Calculation Formula

### Step-by-Step Breakdown:

#### 1. **Residual Value**
```
Residual Value = MSRP × (Residual Percentage ÷ 100)
```

**Example:**
- MSRP: $32,000
- Residual Percentage: 60%
- Residual Value = $32,000 × 0.60 = **$19,200**

---

#### 2. **Cap Cost Reductions**
```
Cap Cost Reductions = Down Payment + Trade-in Value + Rebates
```

**Example:**
- Down Payment: $2,500
- Trade-in Value: $3,000
- Rebates: $1,000
- Cap Cost Reductions = **$6,500**

---

#### 3. **Adjusted Capitalized Cost**
```
Adjusted Cap Cost = Vehicle Price - Cap Cost Reductions + Capitalized Fees
```

Where:
- **Capitalized Fees** = Acquisition Fee + Doc Fee

**Example:**
- Vehicle Price (negotiated): $30,500
- Cap Cost Reductions: $6,500
- Acquisition Fee: $595
- Doc Fee: $499
- Capitalized Fees = $1,094
- Adjusted Cap Cost = $30,500 - $6,500 + $1,094 = **$25,094**

---

#### 4. **Monthly Depreciation Fee**
```
Depreciation Fee = (Adjusted Cap Cost - Residual Value) ÷ Term Months
```

**Example:**
- Adjusted Cap Cost: $25,094
- Residual Value: $19,200
- Term: 36 months
- Depreciation Fee = ($25,094 - $19,200) ÷ 36 = **$163.72/mo**

---

#### 5. **Monthly Finance Charge**
```
Finance Charge = (Adjusted Cap Cost + Residual Value) × Money Factor
```

**Example:**
- Adjusted Cap Cost: $25,094
- Residual Value: $19,200
- Money Factor: 0.0010
- Finance Charge = ($25,094 + $19,200) × 0.0010 = **$44.29/mo**

> **Note:** Money Factor ≈ APR ÷ 2400
> - 0.0010 money factor ≈ 2.4% APR
> - 0.0016 money factor ≈ 3.84% APR

---

#### 6. **Total Monthly Payment**
```
Base Payment = Depreciation Fee + Finance Charge
Monthly Tax = Base Payment × Tax Rate
Total Monthly Payment = Base Payment + Monthly Tax
```

**Example:**
- Depreciation Fee: $163.72
- Finance Charge: $44.29
- Base Payment = **$208.01**
- Monthly Tax (6.5%): $208.01 × 0.065 = $13.52
- **Total Monthly Payment = $221.53**

---

## 💾 Database Schema

### New Fields in `credit_applications` Table:

```sql
-- Deal Type
deal_type VARCHAR(10) CHECK (deal_type IN ('finance', 'lease')) DEFAULT 'finance'

-- Vehicle Pricing
vehicle_msrp DECIMAL(12,2)
down_payment DECIMAL(12,2) DEFAULT 0
trade_in_value DECIMAL(12,2) DEFAULT 0
rebate_amount DECIMAL(12,2) DEFAULT 0

-- Fees
acquisition_fee DECIMAL(10,2) DEFAULT 0
doc_fee DECIMAL(10,2) DEFAULT 0

-- Lease Terms
residual_percentage DECIMAL(5,2)
money_factor DECIMAL(8,6)

-- Calculated Values (auto-calculated by trigger)
residual_value DECIMAL(12,2)
cap_cost_reductions DECIMAL(12,2)
capitalized_fees DECIMAL(12,2)
adjusted_cap_cost DECIMAL(12,2)
depreciation_fee DECIMAL(10,2)
finance_charge DECIMAL(10,2)
base_monthly_payment DECIMAL(10,2)
sales_tax_rate DECIMAL(5,4) DEFAULT 0
monthly_tax DECIMAL(10,2)
estimated_monthly_payment DECIMAL(10,2)

-- Mileage
annual_mileage INT DEFAULT 12000
excess_mileage_rate DECIMAL(5,2) DEFAULT 0.25

-- Totals
total_lease_cost DECIMAL(12,2)
lease_end_buyout_price DECIMAL(12,2)
```

### Automatic Calculation Trigger

The system includes a PostgreSQL trigger function `calculate_lease_values()` that automatically calculates all lease values when a credit application is inserted or updated.

---

## 🔌 API Endpoints

### POST `/api/finance/credit-application`

**Accepts additional lease fields:**

```json
{
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "555-1234",
  
  "deal_type": "lease",
  
  "vehicle_msrp": 32000,
  "vehicle_purchase_price": 30500,
  "down_payment": 2500,
  "trade_in_value": 3000,
  "rebate_amount": 1000,
  
  "acquisition_fee": 595,
  "doc_fee": 499,
  
  "residual_percentage": 60,
  "money_factor": 0.0010,
  "sales_tax_rate": 0.065,
  
  "requested_term_months": 36,
  "annual_mileage": 12000,
  "excess_mileage_rate": 0.25,
  
  "credit_score": 750
}
```

**Response includes calculated values:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "deal_type": "lease",
    "estimated_monthly_payment": 221.53,
    "residual_value": 19200,
    "total_lease_cost": 10475.08,
    "lease_end_buyout_price": 19200,
    ...
  }
}
```

---

## 🎨 Frontend Implementation

### Credit Application Form

The `CustomerCreditApplication.tsx` component includes:

1. **Finance/Lease Toggle**: Select between finance and lease options
2. **Dynamic Form Fields**: Shows relevant fields based on selection
3. **Real-Time Calculator**: Instant payment calculation as user types
4. **Visual Breakdown**: Displays depreciation, finance charge, tax breakdown

### Key Features:

```typescript
// Deal type selector
<Select value={formData.deal_type} onValueChange={...}>
  <SelectItem value="finance">Finance (Loan)</SelectItem>
  <SelectItem value="lease">Lease</SelectItem>
</Select>

// Real-time calculation
const calculateLeasePayment = () => {
  const msrp = parseFloat(formData.vehicle_msrp);
  const residualPct = parseFloat(formData.residual_percentage);
  const moneyFactor = parseFloat(formData.money_factor);
  // ... perform calculation
  return { monthlyPayment, residualValue, totalCost };
};
```

### Visual Calculator Display:

- **Large Monthly Payment**: Prominently displayed
- **Payment Breakdown**: Shows depreciation vs. finance charge
- **Total Lease Cost**: Over full term
- **Buyout Price**: Residual value at lease end

---

## 📊 Real-World Examples

### Example 1: Luxury Sedan (High Residual)

**Vehicle:** 2024 BMW 3 Series
- MSRP: $45,000
- Negotiated Price: $43,000
- Down Payment: $3,000
- Trade-in: $5,000
- Rebates: $1,500
- Acquisition Fee: $695
- Doc Fee: $499
- **Residual: 65%** (High!)
- Money Factor: 0.0012
- Term: 36 months
- Tax Rate: 6.5%

**Calculation:**
```
Residual Value = $45,000 × 0.65 = $29,250
Cap Cost Reductions = $3,000 + $5,000 + $1,500 = $9,500
Capitalized Fees = $695 + $499 = $1,194
Adjusted Cap Cost = $43,000 - $9,500 + $1,194 = $34,694

Depreciation Fee = ($34,694 - $29,250) ÷ 36 = $151.22
Finance Charge = ($34,694 + $29,250) × 0.0012 = $76.73
Base Payment = $151.22 + $76.73 = $227.95
Monthly Tax = $227.95 × 0.065 = $14.82
Total Monthly = $242.77
```

**Result: $242.77/month** ✨

---

### Example 2: Economy Car (Lower Residual)

**Vehicle:** 2024 Hyundai Elantra
- MSRP: $22,000
- Negotiated Price: $21,000
- Down Payment: $2,000
- No Trade-in
- Rebates: $500
- Acquisition Fee: $595
- Doc Fee: $399
- **Residual: 52%** (Lower)
- Money Factor: 0.0015
- Term: 36 months
- Tax Rate: 6.5%

**Calculation:**
```
Residual Value = $22,000 × 0.52 = $11,440
Cap Cost Reductions = $2,000 + $0 + $500 = $2,500
Capitalized Fees = $595 + $399 = $994
Adjusted Cap Cost = $21,000 - $2,500 + $994 = $19,494

Depreciation Fee = ($19,494 - $11,440) ÷ 36 = $223.72
Finance Charge = ($19,494 + $11,440) × 0.0015 = $46.40
Base Payment = $223.72 + $46.40 = $270.12
Monthly Tax = $270.12 × 0.065 = $17.56
Total Monthly = $287.68
```

**Result: $287.68/month**

---

## 🚀 Running the Migration

### Step 1: Run Database Migration

```bash
cd src/database
node run-lease-credit-app-migration.js
```

This will:
- Add all lease-specific columns to `credit_applications`
- Create the `calculate_lease_values()` trigger function
- Set up automatic calculation on insert/update

### Step 2: Restart Backend Server

```bash
npm run dev:backend
```

### Step 3: Test Frontend

```bash
npm run dev:frontend
```

Navigate to the credit application form and test:
1. Toggle between Finance and Lease
2. Enter lease details
3. Watch real-time calculation update
4. Submit and verify data saved correctly

---

## 🧪 Testing Scenarios

### Test Case 1: Basic Lease
- MSRP: $30,000
- Residual: 60%
- Money Factor: 0.0010
- Term: 36 months
- Expected: ~$200-250/month

### Test Case 2: High Residual (Luxury)
- MSRP: $50,000
- Residual: 65%
- Money Factor: 0.0008
- Term: 36 months
- Expected: Lower monthly payment

### Test Case 3: Low Residual (High Depreciation)
- MSRP: $25,000
- Residual: 50%
- Money Factor: 0.0020
- Term: 36 months
- Expected: Higher monthly payment

---

## 📚 Residual Percentage Guidelines

### Typical Residual Values by Credit Tier:

| Credit Tier | Score Range | 36-Month Residual |
|-------------|-------------|-------------------|
| Tier 1      | 750+        | 58-65%            |
| Tier 2      | 700-749     | 56-60%            |
| Tier 3      | 650-699     | 54-58%            |
| Tier 4      | 600-649     | 52-56%            |
| Tier 5      | <600        | 50-54%            |

### By Vehicle Type:

| Vehicle Type | Typical Residual |
|--------------|------------------|
| Luxury Sedan | 60-65%           |
| Mid-Size SUV | 58-62%           |
| Compact Car  | 52-58%           |
| Pickup Truck | 62-68%           |
| Sports Car   | 55-60%           |

---

## 💡 Tips for Customers

### How to Get the Best Lease Deal:

1. **Choose High-Residual Vehicles**: Luxury brands often have better residuals
2. **Negotiate the Price**: Lower selling price = lower monthly payment
3. **Maximize Down Payment**: Reduces capitalized cost
4. **Use Trade-Ins & Rebates**: Both reduce capitalized cost
5. **Watch the Money Factor**: Lower = better (like APR)
6. **Consider Lease-End Value**: May be worth buying if market value > residual

---

## 🔧 Configuration

### Default Values (in frontend):

```typescript
acquisition_fee: '595'
doc_fee: '499'
sales_tax_rate: '0.065' // 6.5%
annual_mileage: '12000'
excess_mileage_rate: '0.25' // $0.25/mile
```

### Adjusting Defaults:

Update in `src/pages/CustomerCreditApplication.tsx`:

```typescript
const [formData, setFormData] = useState<ApplicationFormData>({
  // ... other fields
  acquisition_fee: '595', // Change here
  doc_fee: '499', // Change here
  sales_tax_rate: '0.075', // Update to your state's rate
  // ...
});
```

---

## 📞 Support

For questions or issues with the lease implementation:

1. Check this documentation
2. Review the database migration logs
3. Inspect browser console for calculation errors
4. Verify all required fields are provided

---

## ✅ Checklist

- [x] Database migration completed
- [x] Backend API accepts lease fields
- [x] Frontend form includes lease options
- [x] Real-time calculator implemented
- [x] Automatic calculation trigger created
- [x] Documentation completed

---

**Implementation Date:** November 26, 2025  
**Version:** 1.0  
**System:** DealerIQ - Vehicle Management & Finance Platform

