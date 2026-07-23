/**
 * Protection Products Service
 * Handles optional protection products (GAP, VSC, etc.) for finance deals
 */

import { query } from '../database/connection.js';

class ProtectionProductsService {
  /**
   * Add protection product to a deal
   * @param {object} data - Product data
   * @param {string} data.dealId - Deal UUID
   * @param {string} data.productType - Product type (GAP, VSC, etc.)
   * @param {string} data.productName - Product name
   * @param {number} data.price - Product price
   * @param {boolean} data.isFinanced - Whether product is financed
   * @param {string} [data.providerName] - Provider name
   * @param {number} [data.dealerProfit] - Dealer profit portion
   * @param {number} [data.termMonths] - Term in months for monthly calculation
   * @returns {Promise<object>} Created product
   */
  async addProduct(data) {
    const {
      dealId,
      productType,
      productName,
      price,
      isFinanced = true,
      providerName = null,
      dealerProfit = 0,
      termMonths = 60
    } = data;

    if (!dealId || !productType || !productName || !price) {
      throw new Error('Missing required fields: dealId, productType, productName, price');
    }

    // Calculate monthly payment impact if financed
    const monthlyPaymentImpact = isFinanced && price > 0 
      ? Math.round((price / termMonths) * 100) / 100 
      : 0;

    // Calculate provider payment (price - dealer profit)
    const providerPayment = Math.round((price - dealerProfit) * 100) / 100;

    const insertQuery = `
      INSERT INTO finance_deal_products (
        deal_id, product_type, product_name, price, is_required, is_financed,
        provider_name, dealer_profit, provider_payment, monthly_payment_impact
      )
      VALUES ($1, $2, $3, $4, FALSE, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await query(insertQuery, [
      dealId,
      productType,
      productName,
      price,
      isFinanced,
      providerName,
      dealerProfit,
      providerPayment,
      monthlyPaymentImpact
    ]);

    // Update deal totals
    await this.updateDealTotals(dealId);

    return result.rows[0];
  }

  /**
   * Get all products for a deal
   * @param {string} dealId - Deal UUID
   * @returns {Promise<Array>} Products array
   */
  async getDealProducts(dealId) {
    const result = await query(
      'SELECT * FROM finance_deal_products WHERE deal_id = $1 ORDER BY created_at',
      [dealId]
    );
    return result.rows;
  }

  /**
   * Remove product from deal
   * @param {string} productId - Product UUID
   * @returns {Promise<boolean>} Success
   */
  async removeProduct(productId) {
    // Get deal ID first
    const productResult = await query(
      'SELECT deal_id FROM finance_deal_products WHERE id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }

    const dealId = productResult.rows[0].deal_id;

    // Delete product
    await query('DELETE FROM finance_deal_products WHERE id = $1', [productId]);

    // Update deal totals
    await this.updateDealTotals(dealId);

    return true;
  }

  /**
   * Update product
   * @param {string} productId - Product UUID
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} Updated product
   */
  async updateProduct(productId, updates) {
    const allowedFields = ['product_name', 'price', 'is_financed', 'provider_name', 'dealer_profit'];
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramIndex}`);
        updateValues.push(value);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Get deal ID and term for monthly calculation
    const productResult = await query(
      'SELECT deal_id FROM finance_deal_products WHERE id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new Error('Product not found');
    }

    const dealId = productResult.rows[0].deal_id;

    // Get deal term
    const dealResult = await query(
      'SELECT term_months FROM finance_deals WHERE id = $1',
      [dealId]
    );

    const termMonths = dealResult.rows[0]?.term_months || 60;
    const price = updates.price;

    // Recalculate monthly payment impact if price or is_financed changed
    if (updates.price !== undefined || updates.is_financed !== undefined) {
      const isFinanced = updates.is_financed !== undefined ? updates.is_financed : 
        (await query('SELECT is_financed FROM finance_deal_products WHERE id = $1', [productId])).rows[0].is_financed;
      
      const finalPrice = price !== undefined ? price : 
        (await query('SELECT price FROM finance_deal_products WHERE id = $1', [productId])).rows[0].price;

      const monthlyPaymentImpact = isFinanced && finalPrice > 0 
        ? Math.round((finalPrice / termMonths) * 100) / 100 
        : 0;

      updateFields.push(`monthly_payment_impact = $${paramIndex}`);
      updateValues.push(monthlyPaymentImpact);
      paramIndex++;

      if (updates.price !== undefined && updates.dealer_profit !== undefined) {
        const providerPayment = Math.round((finalPrice - updates.dealer_profit) * 100) / 100;
        updateFields.push(`provider_payment = $${paramIndex}`);
        updateValues.push(providerPayment);
        paramIndex++;
      }
    }

    updateValues.push(productId);

    const updateQuery = `
      UPDATE finance_deal_products 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(updateQuery, updateValues);

    // Update deal totals
    await this.updateDealTotals(dealId);

    return result.rows[0];
  }

  /**
   * Update deal totals for protection products
   * @param {string} dealId - Deal UUID
   */
  async updateDealTotals(dealId) {
    // Calculate totals
    const totalsResult = await query(`
      SELECT 
        COALESCE(SUM(price), 0) as total_products,
        COALESCE(SUM(monthly_payment_impact), 0) as total_monthly
      FROM finance_deal_products
      WHERE deal_id = $1
    `, [dealId]);

    const totals = totalsResult.rows[0];

    // Update deal
    await query(`
      UPDATE finance_deals 
      SET 
        total_protection_products = $1,
        protection_products_monthly = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [totals.total_products, totals.total_monthly, dealId]);
  }
}

export default new ProtectionProductsService();

