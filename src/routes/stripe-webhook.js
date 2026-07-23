import express from 'express';
import { query } from '../database/connection.js';

const router = express.Router();

// This file expects raw body parsing to be set up in server.js before JSON parsing
export default (stripe) => {
  router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    try {
      const secretResult = await query(
        `SELECT secret FROM integration_settings WHERE scope = 'global' AND provider = 'stripe' AND key = 'webhook_secret' AND is_active = true`
      );
      if (!secretResult.rows.length) {
        return res.status(500).send('Stripe webhook secret not configured');
      }
      const webhookSecret = secretResult.rows[0].secret;

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err) {
        console.error('Stripe webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      switch (event.type) {
        case 'invoice.paid':
          // Optionally record invoice paid event
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const dealerId = subscription.metadata?.dealer_id;
          if (dealerId) {
            await query(
              `UPDATE dealers SET 
                 stripe_subscription_id = $1,
                 subscription_status = $2,
                 subscription_current_period_end = to_timestamp($3),
                 updated_at = NOW()
               WHERE id = $4`,
              [subscription.id, subscription.status, Math.floor(subscription.current_period_end || 0), dealerId]
            );
          }
          break;
        }
        default:
          // Ignore other events for now
          break;
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Stripe webhook handling error:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
};


