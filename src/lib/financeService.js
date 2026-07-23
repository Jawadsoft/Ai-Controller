/**
 * Finance Service - Finance & Lease Terms Management
 * Handles all finance and lease calculations, credit tier management, and deal generation
 * Provides dealer-specific programs with global fallback
 */

import { query } from '../database/connection.js';
import crypto from 'crypto';

class FinanceService {
  constructor() {
    // Encryption key for sensitive data (SSN, DL)
    // In production, this should be from environment variable
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32chars!!';
    this.algorithm = 'aes-256-cbc';
    
    // Cache for frequently accessed terms (dealer-specific)
    this.termsCache = new Map(); // dealerId_type_term_creditScore -> term data
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    
    // Credit tier definitions (U.S. standard)
    this.creditTiers = {
      1: { min: 750, max: 850, label: 'Excellent', aprRange: [2.9, 5.9], mfRange: [0.0010, 0.0015] },
      2: { min: 700, max: 749, label: 'Good', aprRange: [6.0, 8.5], mfRange: [0.0016, 0.0020] },
      3: { min: 650, max: 699, label: 'Fair', aprRange: [8.6, 11.9], mfRange: [0.0021, 0.0027] },
      4: { min: 600, max: 649, label: 'Poor', aprRange: [12, 17], mfRange: [0.0028, 0.0035] },
      5: { min: 300, max: 599, label: 'Subprime', aprRange: [18, 25], mfRange: [0.0036, 0.0050] }
    };
  }

  /**
   * Encrypt sensitive data (SSN, DL) using AES256
   * @param {string} data - Plain text data to encrypt
   * @returns {string} Encrypted hex string
   */
  encrypt(data) {
    if (!data) return null;
    
    try {
      // Generate a random IV for each encryption
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey.substring(0, 32).padEnd(32, '0'), 'utf8'),
        iv
      );
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Prepend IV to encrypted data for decryption
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt sensitive data (SSN, DL) using AES256
   * @param {string} encryptedData - Encrypted hex string with IV
   * @returns {string} Decrypted plain text
   */
  decrypt(encryptedData) {
    if (!encryptedData) return null;
    
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey.substring(0, 32).padEnd(32, '0'), 'utf8'),
        iv
      );
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  /**
   * Calculate finance payment (loan) using standard formula
   * @param {number} price - Vehicle price
   * @param {number} downPayment - Down payment amount
   * @param {number} apr - Annual Percentage Rate (as percentage, e.g., 5.5 for 5.5%)
   * @param {number} termMonths - Loan term in months
   * @returns {number} Monthly payment amount
   */
  calculateFinancePayment(price, downPayment, apr, termMonths) {
    if (!price || price <= 0) {
      throw new Error('Vehicle price must be greater than 0');
    }
    if (downPayment < 0 || downPayment >= price) {
      throw new Error('Down payment must be between 0 and vehicle price');
    }
    if (termMonths <= 0) {
      throw new Error('Term months must be greater than 0');
    }
    
    const principal = price - downPayment;
    
    // If APR is 0, return simple monthly payment
    if (apr === 0) {
      return principal / termMonths;
    }
    
    const monthlyRate = apr / 100 / 12;
    
    // Standard loan payment formula: P * (r(1+r)^n) / ((1+r)^n - 1)
    const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
                          (Math.pow(1 + monthlyRate, termMonths) - 1);
    
    // Round to 2 decimal places
    return Math.round(monthlyPayment * 100) / 100;
  }

  /**
   * Calculate lease payment using standard formula per Developer Notes
   * Implements: Residual = MSRP × ResidualPercent
   * AdjustedCapCost = CapCost - CapCostReductions + CapitalizedFees
   * Depreciation = (AdjustedCapCost - Residual) / TermMonths
   * FinanceCharge = (AdjustedCapCost + Residual) × MoneyFactor
   * BasePayment = Depreciation + FinanceCharge
   * MonthlyTax = BasePayment × TaxRate
   * TotalMonthlyPayment = BasePayment + MonthlyTax
   * 
   * @param {object} params - Lease calculation parameters
   * @param {number} params.msrp - Manufacturer Suggested Retail Price
   * @param {number} params.capCost - Capitalized cost (vehicle price)
   * @param {number} params.capCostReductions - Reductions from cap cost (default: 0)
   * @param {number} params.capitalizedFees - Fees added to cap cost (default: 0)
   * @param {number} params.residualPct - Residual value percentage (e.g., 58 for 58%)
   * @param {number} params.termMonths - Lease term in months
   * @param {number} params.moneyFactor - Money factor (e.g., 0.00125)
   * @param {number} params.taxRate - Tax rate (e.g., 0.065 for 6.5%, default: 0)
   * @returns {object} Complete lease calculation breakdown
   */
  calculateLeasePayment({
    msrp,
    capCost,
    capCostReductions = 0,
    capitalizedFees = 0,
    residualPct,
    termMonths,
    moneyFactor,
    taxRate = 0
  }) {
    // Validation
    if (!msrp || msrp <= 0) {
      throw new Error('MSRP must be greater than 0');
    }
    if (!capCost || capCost <= 0) {
      throw new Error('Capitalized cost must be greater than 0');
    }
    if (residualPct < 0 || residualPct > 100) {
      throw new Error('Residual percentage must be between 0 and 100');
    }
    if (termMonths <= 0) {
      throw new Error('Term months must be greater than 0');
    }
    if (moneyFactor < 0) {
      throw new Error('Money factor must be non-negative');
    }
    if (taxRate < 0 || taxRate > 1) {
      throw new Error('Tax rate must be between 0 and 1');
    }
    
    // Step 1: Calculate Residual Value (based on MSRP, not CapCost)
    const residualValue = msrp * (residualPct / 100);
    
    // Step 2: Calculate Adjusted Cap Cost
    const adjustedCapCost = capCost - capCostReductions + capitalizedFees;
    
    // Step 3: Calculate Depreciation Fee (Monthly)
    const depreciationFee = (adjustedCapCost - residualValue) / termMonths;
    
    // Step 4: Calculate Finance (Rent) Charge (Monthly)
    const financeCharge = (adjustedCapCost + residualValue) * moneyFactor;
    
    // Step 5: Calculate Base Monthly Payment (Before Tax)
    const basePayment = depreciationFee + financeCharge;
    
    // Step 6: Calculate Tax on Payment
    const monthlyTax = basePayment * taxRate;
    
    // Step 7: Calculate Total Monthly Payment
    const totalMonthlyPayment = basePayment + monthlyTax;
    
    // Round all values to 2 decimal places
    const round = (val) => Math.round(val * 100) / 100;
    
    return {
      residualValue: round(residualValue),
      adjustedCapCost: round(adjustedCapCost),
      depreciationFee: round(depreciationFee),
      financeCharge: round(financeCharge),
      basePayment: round(basePayment),
      monthlyTax: round(monthlyTax),
      totalMonthlyPayment: round(totalMonthlyPayment),
      // For backward compatibility, also return the old format
      monthlyPayment: round(totalMonthlyPayment)
    };
  }

  /**
   * Calculate mileage-related charges for lease
   * @param {object} params - Mileage calculation parameters
   * @param {number} params.annualMileage - Annual mileage allowance
   * @param {number} params.termMonths - Lease term in months
   * @param {number} params.actualMiles - Actual miles at lease end (optional)
   * @param {number} params.excessMileageRate - Charge per mile for excess mileage
   * @returns {object} Mileage calculation breakdown
   */
  calculateMileageCharges({
    annualMileage,
    termMonths,
    actualMiles = null,
    excessMileageRate = 0.25
  }) {
    if (!annualMileage || annualMileage <= 0) {
      throw new Error('Annual mileage must be greater than 0');
    }
    if (!termMonths || termMonths <= 0) {
      throw new Error('Term months must be greater than 0');
    }
    
    // Calculate allowed miles
    const allowedMiles = Math.round(annualMileage * termMonths / 12);
    
    // If actual miles provided, calculate excess
    let excessMiles = 0;
    let excessMileageCharge = 0;
    
    if (actualMiles !== null && actualMiles >= 0) {
      excessMiles = Math.max(0, actualMiles - allowedMiles);
      excessMileageCharge = excessMiles * excessMileageRate;
    }
    
    return {
      allowedMiles,
      actualMiles: actualMiles !== null ? actualMiles : null,
      excessMiles,
      excessMileageCharge: Math.round(excessMileageCharge * 100) / 100
    };
  }

  /**
   * Calculate government fees (TTL - Tax, Title, License)
   * @param {object} params - TTL fee parameters
   * @param {number} params.vehiclePrice - Vehicle selling price
   * @param {number} params.salesTaxRate - Sales tax rate (e.g., 0.065 for 6.5%)
   * @param {number} params.titleFee - Title fee (default: 0)
   * @param {number} params.licenseFee - License fee (default: 0)
   * @param {number} params.registrationFee - Registration fee (default: 0)
   * @param {number} params.inspectionFee - Inspection fee (default: 0)
   * @param {number} params.processingFee - Processing/document fee (default: 0)
   * @returns {object} Government fees breakdown
   */
  calculateGovernmentFees({
    vehiclePrice,
    salesTaxRate = 0,
    titleFee = 0,
    licenseFee = 0,
    registrationFee = 0,
    inspectionFee = 0,
    processingFee = 0
  }) {
    if (!vehiclePrice || vehiclePrice <= 0) {
      throw new Error('Vehicle price must be greater than 0');
    }

    const round = (val) => Math.round(val * 100) / 100;
    
    // Calculate sales tax on vehicle price
    const salesTax = round(vehiclePrice * salesTaxRate);
    
    // Sum all government fees
    const totalGovernmentFees = round(
      salesTax + titleFee + licenseFee + registrationFee + inspectionFee + processingFee
    );

    return {
      salesTax: round(salesTax),
      titleFee: round(titleFee),
      licenseFee: round(licenseFee),
      registrationFee: round(registrationFee),
      inspectionFee: round(inspectionFee),
      processingFee: round(processingFee),
      totalGovernmentFees: round(totalGovernmentFees)
    };
  }

  /**
   * Calculate trade-in equity/negative equity
   * @param {object} params - Trade-in parameters
   * @param {number} params.acv - Actual Cash Value (what dealer gives)
   * @param {number} params.payoff - Amount customer still owes
   * @returns {object} Trade-in calculation breakdown
   */
  calculateTradeInEquity({ acv, payoff = 0 }) {
    if (acv === null || acv === undefined) {
      return {
        acv: 0,
        payoff: 0,
        netCredit: 0,
        negativeEquity: 0,
        equity: 0
      };
    }

    if (acv < 0) {
      throw new Error('ACV cannot be negative');
    }
    if (payoff < 0) {
      throw new Error('Payoff cannot be negative');
    }

    const round = (val) => Math.round(val * 100) / 100;
    
    const netCredit = round(acv - payoff);
    const negativeEquity = netCredit < 0 ? round(Math.abs(netCredit)) : 0;
    const equity = netCredit > 0 ? round(netCredit) : 0;

    return {
      acv: round(acv),
      payoff: round(payoff),
      netCredit: round(netCredit),
      negativeEquity: round(negativeEquity),
      equity: round(equity)
    };
  }

  /**
   * Calculate amount financed
   * Formula: Vehicle Price + Add-Ons + Government Fees + Protection Products + Negative Equity - Down Payment - Trade Equity
   * @param {object} params - Amount financed parameters
   * @param {number} params.vehiclePrice - Vehicle selling price
   * @param {number} params.addOns - Add-on products/accessories (default: 0)
   * @param {number} params.governmentFees - Total government fees (default: 0)
   * @param {number} params.protectionProducts - Total protection products cost (default: 0)
   * @param {number} params.negativeEquity - Negative equity from trade-in (default: 0)
   * @param {number} params.downPayment - Down payment (default: 0)
   * @param {number} params.tradeEquity - Positive equity from trade-in (default: 0)
   * @returns {number} Amount financed
   */
  calculateAmountFinanced({
    vehiclePrice,
    addOns = 0,
    governmentFees = 0,
    protectionProducts = 0,
    negativeEquity = 0,
    downPayment = 0,
    tradeEquity = 0
  }) {
    if (!vehiclePrice || vehiclePrice <= 0) {
      throw new Error('Vehicle price must be greater than 0');
    }

    const amountFinanced = vehiclePrice + addOns + governmentFees + protectionProducts + negativeEquity - downPayment - tradeEquity;
    
    return Math.round(Math.max(0, amountFinanced) * 100) / 100;
  }

  /**
   * Calculate protection product monthly payment impact
   * @param {number} productPrice - Total product price
   * @param {number} termMonths - Loan/lease term in months
   * @param {boolean} isFinanced - Whether product is financed
   * @returns {number} Monthly payment impact
   */
  calculateProtectionProductMonthly(productPrice, termMonths, isFinanced = true) {
    if (!isFinanced || !productPrice || productPrice <= 0) {
      return 0;
    }
    if (!termMonths || termMonths <= 0) {
      throw new Error('Term months must be greater than 0');
    }

    return Math.round((productPrice / termMonths) * 100) / 100;
  }

  /**
   * Get credit tier information for a given credit score
   * @param {number} creditScore - Credit score (300-850)
   * @returns {object} Tier information { tier, label, min, max }
   */
  getCreditTier(creditScore) {
    if (!creditScore || creditScore < 300 || creditScore > 850) {
      return { tier: 5, label: 'Unknown', min: 300, max: 850 };
    }
    
    for (const [tier, info] of Object.entries(this.creditTiers)) {
      if (creditScore >= info.min && creditScore <= info.max) {
        return {
          tier: parseInt(tier),
          label: info.label,
          min: info.min,
          max: info.max
        };
      }
    }
    
    // Default to subprime if no match
    return { tier: 5, label: 'Subprime', min: 300, max: 599 };
  }

  /**
   * Get finance/lease terms by credit score with dealer-specific fallback to global
   * @param {string} dealerId - Dealer UUID (null for global only)
   * @param {string} type - 'finance' or 'lease'
   * @param {number} termMonths - Loan/lease term in months
   * @param {number} creditScore - Customer credit score
   * @returns {Promise<object|null>} Finance term object or null if not found
   */
  async getTermsByCreditScore(dealerId, type, termMonths, creditScore) {
    if (!type || !['finance', 'lease'].includes(type)) {
      throw new Error('Type must be "finance" or "lease"');
    }
    if (!termMonths || termMonths <= 0) {
      throw new Error('Term months must be greater than 0');
    }
    if (!creditScore || creditScore < 300 || creditScore > 850) {
      throw new Error('Credit score must be between 300 and 850');
    }
    
    // Check cache first
    const cacheKey = `${dealerId || 'global'}_${type}_${termMonths}_${creditScore}`;
    const cached = this.termsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    
    try {
      let result;
      
      // First, try dealer-specific programs if dealerId provided
      if (dealerId) {
        const dealerQuery = `
          SELECT * FROM finance_terms_master
          WHERE dealer_id = $1 
            AND type = $2 
            AND term_months = $3
            AND tier_min_score <= $4 
            AND tier_max_score >= $4
            AND is_active = TRUE
            AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
          ORDER BY 
            CASE 
              WHEN effective_date <= CURRENT_DATE THEN 0
              ELSE 1
            END,
            interest_rate ASC NULLS LAST,
            money_factor ASC NULLS LAST
          LIMIT 1
        `;
        
        result = await query(dealerQuery, [dealerId, type, termMonths, creditScore]);
      }
      
      // If no dealer-specific program found, fall back to global programs
      if (!result || result.rows.length === 0) {
        const globalQuery = `
          SELECT * FROM finance_terms_master
          WHERE dealer_id IS NULL
            AND type = $1 
            AND term_months = $2
            AND tier_min_score <= $3 
            AND tier_max_score >= $3
            AND is_active = TRUE
            AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
          ORDER BY 
            CASE 
              WHEN effective_date <= CURRENT_DATE THEN 0
              ELSE 1
            END,
            interest_rate ASC NULLS LAST,
            money_factor ASC NULLS LAST
          LIMIT 1
        `;
        
        result = await query(globalQuery, [type, termMonths, creditScore]);
      }
      
      const term = result && result.rows.length > 0 ? result.rows[0] : null;
      
      // Cache the result
      if (term) {
        this.termsCache.set(cacheKey, {
          data: term,
          timestamp: Date.now()
        });
      }
      
      return term;
    } catch (error) {
      console.error('Error getting finance terms:', error);
      throw error;
    }
  }

  /**
   * Generate finance deal with full compliance support
   * @param {object} data - Deal data
   * @param {string} data.dealerId - Dealer UUID
   * @param {string} data.vehicleId - Vehicle UUID
   * @param {number} data.price - Vehicle price
   * @param {number} data.downPayment - Down payment
   * @param {number} data.creditScore - Customer credit score
   * @param {number} data.termMonths - Loan term
   * @param {string} [data.conversationId] - DAIVE conversation ID (optional)
   * @param {string} [data.applicationId] - Credit application ID (optional)
   * @param {object} [data.governmentFees] - TTL fees
   * @param {object} [data.tradeIn] - Trade-in details
   * @param {number} [data.addOns] - Add-on products/accessories
   * @param {number} [data.protectionProducts] - Total protection products cost
   * @returns {Promise<object>} Created deal object
   */
  async generateFinanceDeal(data) {
    const { 
      dealerId, 
      vehicleId, 
      price, 
      downPayment = 0, 
      creditScore, 
      termMonths, 
      conversationId, 
      applicationId,
      governmentFees = {},
      tradeIn = {},
      addOns = 0,
      protectionProducts = 0
    } = data;
    
    if (!dealerId || !vehicleId || !price || creditScore === undefined || !termMonths) {
      throw new Error('Missing required fields: dealerId, vehicleId, price, creditScore, termMonths');
    }
    
    // Get finance term for this credit score and term
    const term = await this.getTermsByCreditScore(dealerId, 'finance', termMonths, creditScore);
    
    if (!term) {
      throw new Error(`No finance program found for credit score ${creditScore} and ${termMonths} month term`);
    }
    
    // Calculate government fees (TTL)
    const govFees = this.calculateGovernmentFees({
      vehiclePrice: price,
      salesTaxRate: governmentFees.salesTaxRate || 0,
      titleFee: governmentFees.titleFee || 0,
      licenseFee: governmentFees.licenseFee || 0,
      registrationFee: governmentFees.registrationFee || 0,
      inspectionFee: governmentFees.inspectionFee || 0,
      processingFee: governmentFees.processingFee || 0
    });
    
    // Calculate trade-in equity/negative equity
    const tradeInCalc = this.calculateTradeInEquity({
      acv: tradeIn.acv,
      payoff: tradeIn.payoff || 0
    });
    
    // Calculate amount financed
    const amountFinanced = this.calculateAmountFinanced({
      vehiclePrice: price,
      addOns: addOns,
      governmentFees: govFees.totalGovernmentFees,
      protectionProducts: protectionProducts,
      negativeEquity: tradeInCalc.negativeEquity,
      downPayment: downPayment,
      tradeEquity: tradeInCalc.equity
    });
    
    // Calculate monthly payment based on amount financed
    const monthlyPayment = this.calculateFinancePayment(amountFinanced, 0, term.interest_rate, termMonths);
    const principal = amountFinanced;
    const totalInterest = (monthlyPayment * termMonths) - principal;
    const totalAmount = monthlyPayment * termMonths;
    
    // Create deal record with all new fields
    const insertQuery = `
      INSERT INTO finance_deals (
        dealer_id, conversation_id, application_id, vehicle_id, term_id,
        deal_type, apr, down_payment, monthly_payment, term_months,
        vehicle_price, total_interest, total_amount, status, generated_by,
        sales_tax, title_fee, license_fee, registration_fee, inspection_fee, processing_fee, total_government_fees,
        trade_in_acv, trade_in_payoff, trade_in_net_credit, trade_in_negative_equity, trade_in_equity,
        amount_financed, total_protection_products
      )
      VALUES ($1, $2, $3, $4, $5, 'finance', $6, $7, $8, $9, $10, $11, $12, 'draft', 'ai',
              $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [
      dealerId,
      conversationId || null,
      applicationId || null,
      vehicleId,
      term.id,
      term.interest_rate,
      downPayment,
      monthlyPayment,
      termMonths,
      price,
      Math.round(totalInterest * 100) / 100,
      Math.round(totalAmount * 100) / 100,
      govFees.salesTax,
      govFees.titleFee,
      govFees.licenseFee,
      govFees.registrationFee,
      govFees.inspectionFee,
      govFees.processingFee,
      govFees.totalGovernmentFees,
      tradeInCalc.acv || null,
      tradeInCalc.payoff,
      tradeInCalc.netCredit,
      tradeInCalc.negativeEquity,
      tradeInCalc.equity,
      amountFinanced,
      protectionProducts
    ]);
    
    return result.rows[0];
  }

  /**
   * Generate lease deal with full calculation per Developer Notes
   * @param {object} data - Deal data
   * @param {string} data.dealerId - Dealer UUID
   * @param {string} data.vehicleId - Vehicle UUID
   * @param {number} data.capCost - Capitalized cost
   * @param {number} data.creditScore - Customer credit score
   * @param {number} data.termMonths - Lease term
   * @param {number} [data.msrp] - MSRP (if not provided, will use vehicle price)
   * @param {number} [data.capCostReductions] - Cap cost reductions (default: 0)
   * @param {number} [data.capitalizedFees] - Capitalized fees (default: 0)
   * @param {number} [data.residualPct] - Residual percentage (override term default)
   * @param {number} [data.moneyFactor] - Money factor (override term default)
   * @param {number} [data.taxRate] - Tax rate (default: 0)
   * @param {number} [data.annualMileage] - Annual mileage allowance
   * @param {number} [data.excessMileageRate] - Excess mileage rate per mile
   * @param {string} [data.conversationId] - DAIVE conversation ID (optional)
   * @param {string} [data.applicationId] - Credit application ID (optional)
   * @returns {Promise<object>} Created deal object
   */
  async generateLeaseDeal(data) {
    const { 
      dealerId, 
      vehicleId, 
      capCost, 
      creditScore, 
      termMonths, 
      msrp,
      capCostReductions = 0,
      capitalizedFees = 0,
      residualPct, 
      moneyFactor, 
      taxRate = 0,
      annualMileage,
      excessMileageRate = 0.25,
      conversationId, 
      applicationId 
    } = data;
    
    if (!dealerId || !vehicleId || !capCost || creditScore === undefined || !termMonths) {
      throw new Error('Missing required fields: dealerId, vehicleId, capCost, creditScore, termMonths');
    }
    
    // Get vehicle details to determine MSRP if not provided
    let vehicleMsrp = msrp;
    if (!vehicleMsrp) {
      const vehicleResult = await query('SELECT price FROM vehicles WHERE id = $1', [vehicleId]);
      if (vehicleResult.rows.length === 0) {
        throw new Error('Vehicle not found');
      }
      // If MSRP not provided, use vehicle price as MSRP
      vehicleMsrp = vehicleResult.rows[0].price || capCost;
    }
    
    // Get lease term for this credit score and term
    const term = await this.getTermsByCreditScore(dealerId, 'lease', termMonths, creditScore);
    
    if (!term) {
      throw new Error(`No lease program found for credit score ${creditScore} and ${termMonths} month term`);
    }
    
    // Use provided values or term defaults
    const finalResidualPct = residualPct || term.residual_value_pct;
    const finalMoneyFactor = moneyFactor || term.money_factor;
    
    // Calculate lease payment using new comprehensive method
    const calculation = this.calculateLeasePayment({
      msrp: vehicleMsrp,
      capCost,
      capCostReductions,
      capitalizedFees,
      residualPct: finalResidualPct,
      termMonths,
      moneyFactor: finalMoneyFactor,
      taxRate
    });
    
    // Calculate mileage if annual mileage provided
    let mileageData = null;
    if (annualMileage) {
      mileageData = this.calculateMileageCharges({
        annualMileage,
        termMonths,
        excessMileageRate
      });
    }
    
    // Calculate total amount (monthly payment * term)
    const totalAmount = calculation.totalMonthlyPayment * termMonths;
    
    // Create deal record with all new fields
    const insertQuery = `
      INSERT INTO finance_deals (
        dealer_id, conversation_id, application_id, vehicle_id, term_id,
        deal_type, money_factor, residual_value_pct, monthly_payment, term_months,
        vehicle_price, total_amount, status, generated_by,
        msrp, cap_cost_reductions, capitalized_fees, adjusted_cap_cost,
        residual_value, depreciation_fee, finance_charge, base_payment,
        tax_rate, monthly_tax, total_monthly_payment,
        annual_mileage, excess_mileage_rate, allowed_miles
      )
      VALUES ($1, $2, $3, $4, $5, 'lease', $6, $7, $8, $9, $10, $11, 'draft', 'ai',
              $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *
    `;
    
    const result = await query(insertQuery, [
      dealerId,
      conversationId || null,
      applicationId || null,
      vehicleId,
      term.id,
      finalMoneyFactor,
      finalResidualPct,
      calculation.totalMonthlyPayment, // Store total monthly payment
      termMonths,
      capCost,
      Math.round(totalAmount * 100) / 100,
      vehicleMsrp,
      capCostReductions,
      capitalizedFees,
      calculation.adjustedCapCost,
      calculation.residualValue,
      calculation.depreciationFee,
      calculation.financeCharge,
      calculation.basePayment,
      taxRate,
      calculation.monthlyTax,
      calculation.totalMonthlyPayment,
      annualMileage || null,
      excessMileageRate,
      mileageData ? mileageData.allowedMiles : null
    ]);
    
    return result.rows[0];
  }

  /**
   * Clear cache for a specific dealer or all cache
   * @param {string} [dealerId] - Optional dealer ID to clear specific cache
   */
  clearCache(dealerId = null) {
    if (dealerId) {
      // Clear all entries for this dealer
      for (const [key] of this.termsCache) {
        if (key.startsWith(dealerId)) {
          this.termsCache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.termsCache.clear();
    }
  }
}

// Export singleton instance
export default new FinanceService();

