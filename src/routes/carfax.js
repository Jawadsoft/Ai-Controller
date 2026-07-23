import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../database/connection.js';
import carfaxParserService from '../lib/carfaxParserService.js';
import { upload } from '../lib/imageUpload.js';

const router = express.Router();

// Configure multer for PDF uploads
const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'uploads/carfax';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const vehicleId = req.params.id;
      const timestamp = Date.now();
      const filename = `carfax_${vehicleId}_${timestamp}.pdf`;
      cb(null, filename);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload CARFAX PDF for a vehicle
router.post('/:id/carfax', pdfUpload.single('carfax'), async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    
    console.log(`📄 Uploading CARFAX PDF for vehicle ${vehicleId}`);
    console.log(`📁 File: ${req.file.filename}`);
    
    // Read the uploaded PDF file
    const pdfBuffer = fs.readFileSync(req.file.path);
    
    // Parse the CARFAX PDF
    const parsedData = await carfaxParserService.parseCarfaxPDF(pdfBuffer);
    
    // Get the file URL
    const reportUrl = `/uploads/carfax/${req.file.filename}`;
    
    // Insert CARFAX report into database
    const insertQuery = `
      INSERT INTO carfax_reports (
        vehicle_id, report_url, report_date, uploaded_at, uploaded_by,
        accident_count, service_records, owners,
        title_issues, odometer_rollback, structural_damage, airbag_deployment,
        flood_damage, lemon_title, manufacturer_recall,
        previous_rental, previous_taxi, previous_police, previous_fleet,
        previous_lease, previous_corporate, previous_government, previous_auction,
        previous_repo, previous_salvage, previous_fire, previous_hail,
        previous_theft, previous_vandalism, previous_water, previous_other,
        certified_pre_owned, personal_vehicle, commercial_vehicle,
        summary, notes
      ) VALUES (
        $1, $2, NOW(), NOW(), $3,
        $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21,
        $22, $23, $24, $25,
        $26, $27, $28, $29,
        $30, $31, $32,
        $33, $34
      ) RETURNING id;
    `;
    
    const result = await query(insertQuery, [
      vehicleId, reportUrl, userId,
      parsedData.accident_count, parsedData.service_records, parsedData.owners,
      parsedData.title_issues, parsedData.odometer_rollback, parsedData.structural_damage, parsedData.airbag_deployment,
      parsedData.flood_damage, parsedData.lemon_title, parsedData.manufacturer_recall,
      parsedData.previous_rental, parsedData.previous_taxi, parsedData.previous_police, parsedData.previous_fleet,
      parsedData.previous_lease, parsedData.previous_corporate, parsedData.previous_government, parsedData.previous_auction,
      parsedData.previous_repo, parsedData.previous_salvage, parsedData.previous_fire, parsedData.previous_hail,
      parsedData.previous_theft, parsedData.previous_vandalism, parsedData.previous_water, parsedData.previous_other,
      parsedData.certified_pre_owned, parsedData.personal_vehicle, parsedData.commercial_vehicle,
      parsedData.summary, parsedData.notes
    ]);
    
    const carfaxReportId = result.rows[0].id;
    
    // Update the vehicle's latest CARFAX report reference
    await query(
      'UPDATE vehicles SET latest_carfax_report_id = $1, updated_at = NOW() WHERE id = $2',
      [carfaxReportId, vehicleId]
    );
    
    if (parsedData.needs_manual_review) {
      console.warn(`⚠️ CARFAX report uploaded but could not be auto-parsed (image-based PDF). Manual review required.`);
    } else {
      console.log(`✅ CARFAX report uploaded and parsed successfully`);
      console.log(`📊 Summary: ${parsedData.summary}`);
    }
    
    res.json({
      success: true,
      message: parsedData.needs_manual_review
        ? 'CARFAX report uploaded successfully. The PDF appears to be image-based and could not be auto-parsed — please review the report manually.'
        : 'CARFAX report uploaded and parsed successfully',
      needs_manual_review: parsedData.needs_manual_review || false,
      carfaxReportId,
      parsedData,
      reportUrl
    });
    
  } catch (error) {
    console.error('Error uploading CARFAX report:', error);
    
    // Clean up uploaded file if database operation failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Failed to upload CARFAX report',
      details: error.message 
    });
  }
});

// Get CARFAX reports for a vehicle
router.get('/:id/carfax', async (req, res) => {
  try {
    console.log('🔍 GET CARFAX reports for vehicle:', req.params.id);
    const vehicleId = req.params.id;
    
    const queryText = `
      SELECT 
        cr.*,
        u.name as uploaded_by_name
      FROM carfax_reports cr
      LEFT JOIN users u ON cr.uploaded_by = u.id
      WHERE cr.vehicle_id = $1
      ORDER BY cr.uploaded_at DESC;
    `;
    
    console.log('📊 Executing query for vehicle:', vehicleId);
    const result = await query(queryText, [vehicleId]);
    console.log('📊 Query result:', result.rows.length, 'reports found');
    
    res.json({
      success: true,
      reports: result.rows
    });
    
  } catch (error) {
    console.error('❌ Error fetching CARFAX reports:', error);
    res.status(500).json({ 
      error: 'Failed to fetch CARFAX reports',
      details: error.message 
    });
  }
});

// Get latest CARFAX report for a vehicle
router.get('/:id/carfax/latest', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    
    const queryText = `
      SELECT 
        cr.*,
        u.name as uploaded_by_name
      FROM carfax_reports cr
      LEFT JOIN users u ON cr.uploaded_by = u.id
      WHERE cr.vehicle_id = $1
      ORDER BY cr.uploaded_at DESC
      LIMIT 1;
    `;
    
    const result = await query(queryText, [vehicleId]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        report: null,
        message: 'No CARFAX report found for this vehicle'
      });
    }
    
    res.json({
      success: true,
      report: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error fetching latest CARFAX report:', error);
    res.status(500).json({ error: 'Failed to fetch latest CARFAX report' });
  }
});

// Delete CARFAX report
router.delete('/carfax/:reportId', async (req, res) => {
  try {
    const reportId = req.params.reportId;

    // Get the report details first
    const reportQuery = 'SELECT * FROM carfax_reports WHERE id = $1';
    const reportResult = await query(reportQuery, [reportId]);
    
    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'CARFAX report not found' });
    }
    
    const report = reportResult.rows[0];

    // Clear/repoint FK first: vehicles.latest_carfax_report_id references carfax_reports(id)
    // with default ON DELETE RESTRICT — DELETE on the report would fail otherwise.
    await query(
      `UPDATE vehicles
       SET latest_carfax_report_id = (
         SELECT id FROM carfax_reports
         WHERE vehicle_id = $1 AND id <> $2
         ORDER BY uploaded_at DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT 1
       ),
       updated_at = NOW()
       WHERE latest_carfax_report_id = $2`,
      [report.vehicle_id, reportId]
    );

    await query('DELETE FROM carfax_reports WHERE id = $1', [reportId]);

    // Stored URL is e.g. /uploads/carfax/... — files live under cwd/uploads (see server static)
    if (report.report_url) {
      const relative = String(report.report_url).replace(/^\//, '');
      const pathsToTry = [
        path.join(process.cwd(), relative),
        path.join(process.cwd(), 'public', relative),
      ];
      for (const filePath of pathsToTry) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          break;
        }
      }
    }
    
    console.log(`✅ CARFAX report ${reportId} deleted successfully`);
    
    res.json({
      success: true,
      message: 'CARFAX report deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting CARFAX report:', error);
    res.status(500).json({
      error: 'Failed to delete CARFAX report',
      details: error.message,
    });
  }
});

export default router;
