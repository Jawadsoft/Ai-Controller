import express from 'express';
import { query } from '../database/connection.js';

const router = express.Router();

// Get dealer profile by ID (public access)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'SELECT * FROM dealers WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer profile not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get public dealer profile error:', error);
    res.status(500).json({ error: 'Failed to fetch dealer profile' });
  }
});

// Get dealer profile by hash (public access)
// Supports both direct dealer ID and encrypted/hashed lookups
router.get('/qr/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const { stk } = req.query; // stock number from query parameter (optional)
    
    console.log('🔍 Looking up dealer by hash:', hash);
    
    // First, check if hash is a UUID (direct dealer ID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(hash)) {
      console.log('✅ Hash appears to be a direct dealer ID (UUID)');
      
      const result = await query('SELECT * FROM dealers WHERE id = $1', [hash]);
      if (result.rows.length > 0) {
        console.log('✅ Found dealer by direct ID:', result.rows[0].business_name);
        return res.json(result.rows[0]);
      } else {
        console.log('❌ No dealer found with ID:', hash);
        return res.status(404).json({ error: 'Dealer profile not found' });
      }
    }
    
    // If not a UUID, try encrypted data lookup
    console.log('🔍 Hash is not a UUID, trying encrypted data lookup...');
    const { decryptDealerData, generateDealerHash } = await import('../lib/qrCodeGenerator.js');
    
    // Try to decrypt the hash if it's encrypted data
    try {
      const decryptedData = decryptDealerData(hash);
      if (decryptedData && decryptedData.dealerId) {
        console.log('✅ Successfully decrypted hash, found dealer ID:', decryptedData.dealerId);
        
        // Get dealer by decrypted ID
        const result = await query('SELECT * FROM dealers WHERE id = $1', [decryptedData.dealerId]);
        if (result.rows.length > 0) {
          return res.json(result.rows[0]);
        }
      }
    } catch (decryptError) {
      console.log('⚠️ Hash is not encrypted data, trying hash lookup...');
    }
    
    // If decryption failed, try hash-based lookup (brute force search)
    console.log('🔍 Searching through dealers for hash match...');
    const dealers = await query('SELECT * FROM dealers');
    console.log(`📊 Checking ${dealers.rows.length} dealers`);
    
    let foundDealer = null;
    for (const dealer of dealers.rows) {
      // Try with the provided stock number
      const dealerHash = generateDealerHash(dealer.id, stk);
      if (dealerHash === hash) {
        foundDealer = dealer;
        console.log('✅ Found dealer by hash with stock:', stk);
        break;
      }
      
      // Try with no stock number (default)
      const dealerHashDefault = generateDealerHash(dealer.id, null);
      if (dealerHashDefault === hash) {
        foundDealer = dealer;
        console.log('✅ Found dealer by hash with default stock');
        break;
      }
      
      // Try with 'default' string
      const dealerHashDefaultStr = generateDealerHash(dealer.id, 'default');
      if (dealerHashDefaultStr === hash) {
        foundDealer = dealer;
        console.log('✅ Found dealer by hash with "default" stock');
        break;
      }
    }
    
    if (!foundDealer) {
      console.log('❌ No dealer found for hash:', hash);
      return res.status(404).json({ error: 'Dealer profile not found or QR code is invalid' });
    }
    
    console.log('✅ Returning dealer:', foundDealer.business_name);
    res.json(foundDealer);
  } catch (error) {
    console.error('Get dealer profile by QR hash error:', error);
    res.status(500).json({ error: 'Failed to fetch dealer profile' });
  }
});

export default router;
