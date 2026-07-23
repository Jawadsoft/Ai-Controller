import express from 'express';
import { pool } from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/notifications - Get all notifications for the current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const dealerId = req.user.dealer_id;

    // Get notifications for this user/dealer
    const query = `
      SELECT 
        id,
        type,
        title,
        message,
        read,
        created_at,
        data
      FROM notifications
      WHERE (user_id = $1 OR dealer_id = $2)
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query, [userId, dealerId]);

    res.json({
      success: true,
      notifications: result.rows
    });
  } catch (error) {
    // If table doesn't exist yet, return empty list rather than crashing the UI
    if (error.code === '42P01') {
      return res.json({ success: true, notifications: [] });
    }
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

/**
 * PUT /api/notifications/:id/read - Mark a notification as read
 */
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const query = `
      UPDATE notifications
      SET read = true, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({
      success: true,
      notification: result.rows[0]
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

/**
 * PUT /api/notifications/mark-all-read - Mark all notifications as read
 */
router.put('/mark-all-read', async (req, res) => {
  try {
    const userId = req.user.id;
    const dealerId = req.user.dealer_id;

    const query = `
      UPDATE notifications
      SET read = true, updated_at = NOW()
      WHERE (user_id = $1 OR dealer_id = $2) AND read = false
    `;

    await pool.query(query, [userId, dealerId]);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

/**
 * DELETE /api/notifications/:id - Delete a notification
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const query = `
      DELETE FROM notifications
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    });
  }
});

/**
 * POST /api/notifications - Create a new notification (internal use)
 */
router.post('/', async (req, res) => {
  try {
    const { user_id, dealer_id, type, title, message, data } = req.body;

    const query = `
      INSERT INTO notifications (user_id, dealer_id, type, title, message, data, read, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      user_id,
      dealer_id,
      type,
      title,
      message,
      JSON.stringify(data || {})
    ]);

    res.json({
      success: true,
      notification: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create notification'
    });
  }
});

export default router;
