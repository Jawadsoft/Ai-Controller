import { pool } from './connection.js';

/**
 * DAIVE Follow-Up Default Templates
 * User-friendly, ready-to-use follow-up sequences
 * Dealers can activate these immediately after migration
 */

async function seedFollowUpDefaults() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Seeding DAIVE Follow-Up default templates...\n');

    await client.query('BEGIN');

    // ============================================
    // TEMPLATE 1: HOT LEAD NURTURE (7-Day Sequence)
    // ============================================
    
    console.log('📝 Creating: Hot Lead Nurture template...');
    
    const hotLeadTemplate = await client.query(`
      INSERT INTO followup_rule_templates (
        dealer_id, name, description, category, is_system_default
      ) VALUES (
        NULL, 
        'Hot Lead 7-Day Nurture', 
        'Aggressive follow-up for highly interested leads',
        'lead_nurture',
        true
      ) RETURNING id
    `);

    const hotLeadId = hotLeadTemplate.rows[0].id;

    // Hot Lead Steps
    await client.query(`
      INSERT INTO followup_steps (rule_template_id, step_order, step_name, delay_days, delay_hours, delay_minutes, channel, subject_template, message_template) VALUES
      ($1, 1, 'Immediate Follow-Up', 0, 0, 5, 'sms', NULL, 'Hi {{customer_name}}! Thanks for your interest in {{vehicle_name}}. I''m holding this vehicle for you. When can you come see it? Reply YES to schedule today!'),
      
      ($1, 2, 'Same Day Email', 0, 4, 0, 'email', 'Your {{vehicle_name}} is waiting!', 'Hi {{customer_name}},

Great news! The {{vehicle_name}} you inquired about is still available.

Here''s what makes it special:
✓ Excellent condition
✓ Competitive pricing
✓ Financing available
✓ Ready for immediate delivery

Can I answer any questions? I''m here to help!

[Schedule Test Drive]

Best regards,
Your DAIVE Team'),

      ($1, 3, 'Day 2 Check-In', 1, 0, 0, 'sms', NULL, 'Hi {{customer_name}}! Just checking in about the {{vehicle_name}}. Still interested? We have 2 people looking at it. Should I hold it for you?'),
      
      ($1, 4, 'Day 3 Incentive', 2, 0, 0, 'email', 'Special offer for {{customer_name}}', 'Hi {{customer_name}},

I wanted to personally reach out about your {{vehicle_name}}.

🎁 SPECIAL OFFER (This Week Only):
- $500 additional discount
- Free first oil change
- Extended warranty option

This is a genuinely great deal and I don''t want you to miss it.

Ready to move forward? Let''s schedule your visit!

[Claim This Offer]

Best regards,
Your DAIVE Team'),

      ($1, 5, 'Day 5 Urgency', 4, 0, 0, 'sms', NULL, 'Hi {{customer_name}}! The {{vehicle_name}} you liked has 3 serious buyers. It won''t last through the weekend. Want me to reserve it? Reply YES.'),
      
      ($1, 6, 'Day 7 Final Push', 6, 0, 0, 'email', 'Last chance: {{vehicle_name}}', 'Hi {{customer_name}},

I hate to see you miss out! The {{vehicle_name}} is going into our online auction tomorrow.

This is your LAST CHANCE to get:
→ The vehicle you wanted
→ Our special pricing
→ Priority scheduling

Can we schedule a quick call? I''m here until 7 PM today.

[Call Me Now]

Best regards,
Your DAIVE Team')
    `, [hotLeadId]);

    console.log('✅ Hot Lead template created with 6 steps\n');

    // ============================================
    // TEMPLATE 2: WARM LEAD NURTURE (14-Day Sequence)
    // ============================================
    
    console.log('📝 Creating: Warm Lead Nurture template...');
    
    const warmLeadTemplate = await client.query(`
      INSERT INTO followup_rule_templates (
        dealer_id, name, description, category, is_system_default
      ) VALUES (
        NULL, 
        'Warm Lead 14-Day Nurture', 
        'Steady follow-up for interested but not urgent leads',
        'lead_nurture',
        true
      ) RETURNING id
    `);

    const warmLeadId = warmLeadTemplate.rows[0].id;

    await client.query(`
      INSERT INTO followup_steps (rule_template_id, step_order, step_name, delay_days, delay_hours, delay_minutes, channel, subject_template, message_template) VALUES
      ($1, 1, 'Welcome Message', 0, 2, 0, 'email', 'Thanks for your interest!', 'Hi {{customer_name}},

Thank you for reaching out about {{vehicle_name}}!

I''d love to help you find the perfect vehicle. Here''s what happens next:

1. Review your options
2. Answer any questions you have
3. Schedule a no-pressure test drive
4. Explore financing options

What questions can I answer for you?

Best regards,
Your DAIVE Team'),

      ($1, 2, 'Day 3 Check-In', 3, 0, 0, 'sms', NULL, 'Hi {{customer_name}}! Still thinking about the {{vehicle_name}}? I''m here if you have any questions. Just reply!'),
      
      ($1, 3, 'Day 7 Value Prop', 7, 0, 0, 'email', 'Why choose us?', 'Hi {{customer_name}},

I wanted to share why customers love working with us:

⭐ 4.9/5 customer rating
💰 Best price guarantee
🚗 Largest selection in the area
✅ No-pressure environment
📱 Text/call anytime

Ready to take the next step?

[See Our Reviews]

Best regards,
Your DAIVE Team'),

      ($1, 4, 'Day 14 Final Touch', 14, 0, 0, 'sms', NULL, 'Hi {{customer_name}}! Hope you''re doing well. The {{vehicle_name}} is still available. Would you like to schedule a visit? Just let me know!')
    `, [warmLeadId]);

    console.log('✅ Warm Lead template created with 4 steps\n');

    // ============================================
    // TEMPLATE 3: UNSOLD VISIT RECOVERY (30-Day Sequence)
    // ============================================
    
    console.log('📝 Creating: Unsold Visit Recovery template...');
    
    const unsoldTemplate = await client.query(`
      INSERT INTO followup_rule_templates (
        dealer_id, name, description, category, is_system_default
      ) VALUES (
        NULL, 
        'Unsold Visit Recovery', 
        'Win back customers who visited but didn''t purchase',
        'unsold_visit',
        true
      ) RETURNING id
    `);

    const unsoldId = unsoldTemplate.rows[0].id;

    await client.query(`
      INSERT INTO followup_steps (rule_template_id, step_order, step_name, delay_days, delay_hours, delay_minutes, channel, subject_template, message_template) VALUES
      ($1, 1, 'Same Day Thank You', 0, 4, 0, 'email', 'Great meeting you today!', 'Hi {{customer_name}},

It was wonderful meeting you today! Thanks for taking the time to visit us and test drive the {{vehicle_name}}.

I know you mentioned wanting to think it over. That''s completely understandable - it''s a big decision!

If any questions come up, I''m just a text/call away.

Best regards,
Your DAIVE Team'),

      ($1, 2, '48-Hour Check-In', 2, 0, 0, 'sms', NULL, 'Hi {{customer_name}}! Hope you''re well. Have you made a decision about the {{vehicle_name}}? I''m here to help if you have questions!'),
      
      ($1, 3, 'Week 1 Comparison', 7, 0, 0, 'email', 'How does {{vehicle_name}} compare?', 'Hi {{customer_name}},

I''ve been thinking about your search. How is the {{vehicle_name}} comparing to other vehicles you''ve looked at?

I''d love to help you make the best decision. If there''s anything holding you back, let''s talk it through.

Common concerns I can help with:
→ Pricing/payments
→ Trade-in value
→ Specific features
→ Timing

What''s your main consideration right now?

Best regards,
Your DAIVE Team'),

      ($1, 4, 'Week 2 New Incentive', 14, 0, 0, 'sms', NULL, 'Hi {{customer_name}}! Good news - we just got approved for additional rebates on {{vehicle_name}}. Want to know how much you can save? Call me!'),
      
      ($1, 5, 'Week 3 Similar Options', 21, 0, 0, 'email', 'Found 3 vehicles you might love', 'Hi {{customer_name}},

I know the {{vehicle_name}} might not have been perfect. I found 3 other vehicles that match what you''re looking for:

[Vehicle Option 1]
[Vehicle Option 2]
[Vehicle Option 3]

Any of these catch your eye? I can get you behind the wheel this week.

Best regards,
Your DAIVE Team'),

      ($1, 6, 'Month End Final', 30, 0, 0, 'sms', NULL, 'Hi {{customer_name}}! End of month - best time for deals. The {{vehicle_name}} is still here and I can offer you an amazing price. Interested?')
    `, [unsoldId]);

    console.log('✅ Unsold Visit template created with 6 steps\n');

    // ============================================
    // TEMPLATE 4: POST-PURCHASE ONBOARDING (30-Day Sequence)
    // ============================================
    
    console.log('📝 Creating: Post-Purchase Onboarding template...');
    
    const postPurchaseTemplate = await client.query(`
      INSERT INTO followup_rule_templates (
        dealer_id, name, description, category, is_system_default
      ) VALUES (
        NULL, 
        'Post-Purchase Onboarding', 
        'Welcome new customers and build loyalty',
        'post_purchase',
        true
      ) RETURNING id
    `);

    const postPurchaseId = postPurchaseTemplate.rows[0].id;

    await client.query(`
      INSERT INTO followup_steps (rule_template_id, step_order, step_name, delay_days, delay_hours, delay_minutes, channel, subject_template, message_template) VALUES
      ($1, 1, 'Immediate Thank You', 0, 0, 30, 'email', '🎉 Welcome to the family!', 'Hi {{customer_name}},

Congratulations on your new {{vehicle_name}}! We''re thrilled to have you as part of our family.

Here''s what you need to know:

📱 Download our app for easy service scheduling
🔧 Your first oil change is FREE (within 5,000 miles)
⭐ Join our VIP rewards program
📞 24/7 roadside assistance: 1-800-XXX-XXXX

Enjoy your new ride!

[Download App]

Welcome to the family,
Your DAIVE Team'),

      ($1, 2, 'Day 3 Check-In', 3, 0, 0, 'sms', NULL, 'Hi {{customer_name}}! How are you loving your new {{vehicle_name}}? Any questions about features or settings? I''m here to help!'),
      
      ($1, 3, 'Day 7 Review Request', 7, 0, 0, 'email', 'How was your experience?', 'Hi {{customer_name}},

Hope you''re enjoying your {{vehicle_name}}! 

Would you mind sharing your experience? Your feedback helps other customers and helps us improve.

It takes just 2 minutes:

[Leave a Review]

As a thank you, we''ll enter you to win a $100 gift card!

Thank you,
Your DAIVE Team'),

      ($1, 4, 'Day 14 Referral Request', 14, 0, 0, 'sms', NULL, 'Hi {{customer_name}}! Know anyone looking for a vehicle? Refer a friend and you BOTH get $250! Just have them mention your name.'),
      
      ($1, 5, 'Day 30 Service Reminder', 30, 0, 0, 'email', 'Time for your first service!', 'Hi {{customer_name}},

Your {{vehicle_name}} is ready for its first check-up!

🎁 Don''t forget - your first oil change is FREE!

We''ll:
✓ Change oil & filter
✓ Check all fluids
✓ Inspect brakes
✓ Top off washer fluid
✓ Complete car wash

[Schedule Service]

Takes about 45 minutes. We have coffee and WiFi!

See you soon,
Your DAIVE Team')
    `, [postPurchaseId]);

    console.log('✅ Post-Purchase template created with 5 steps\n');

    // ============================================
    // TEMPLATE 5: SERVICE CUSTOMER REMINDERS
    // ============================================
    
    console.log('📝 Creating: Service Customer Reminders template...');
    
    const serviceTemplate = await client.query(`
      INSERT INTO followup_rule_templates (
        dealer_id, name, description, category, is_system_default
      ) VALUES (
        NULL, 
        'Service Customer Reminders', 
        'Keep service customers coming back',
        'service_customer',
        true
      ) RETURNING id
    `);

    const serviceId = serviceTemplate.rows[0].id;

    await client.query(`
      INSERT INTO followup_steps (rule_template_id, step_order, step_name, delay_days, delay_hours, delay_minutes, channel, subject_template, message_template) VALUES
      ($1, 1, '3-Month Reminder', 90, 0, 0, 'email', 'Time for service?', 'Hi {{customer_name}},

It''s been about 3 months since your last service. Time flies!

Is your {{vehicle_name}} due for:
→ Oil change
→ Tire rotation
→ Brake inspection

[Schedule Service Online]

We''ll get you in and out quickly!

Best regards,
Your DAIVE Service Team'),

      ($1, 2, '6-Month Check-In', 180, 0, 0, 'sms', NULL, 'Hi {{customer_name}}! Your {{vehicle_name}} is due for its 6-month service. Online scheduling available 24/7. Link in email!'),
      
      ($1, 3, 'Seasonal Service', 270, 0, 0, 'email', 'Prepare for winter/summer', 'Hi {{customer_name}},

Time to prepare your {{vehicle_name}} for the season!

Recommended service:
✓ Battery test
✓ Tire inspection
✓ Fluid check
✓ Climate control service

[Schedule Seasonal Service]

Keep your vehicle running great year-round!

Best regards,
Your DAIVE Service Team')
    `, [serviceId]);

    console.log('✅ Service Customer template created with 3 steps\n');

    await client.query('COMMIT');

    console.log('\n🎉 SUCCESS! Default templates created:');
    console.log('   1. Hot Lead 7-Day Nurture (6 steps)');
    console.log('   2. Warm Lead 14-Day Nurture (4 steps)');
    console.log('   3. Unsold Visit Recovery (6 steps)');
    console.log('   4. Post-Purchase Onboarding (5 steps)');
    console.log('   5. Service Customer Reminders (3 steps)');
    console.log('\n✅ Total: 5 templates with 24 follow-up steps');
    console.log('\n📝 Next steps:');
    console.log('   1. Access settings at: /followup/settings');
    console.log('   2. Configure email/SMS credentials in .env');
    console.log('   3. Enable the system');
    console.log('   4. Start nurturing customers automatically!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error seeding defaults:', error);
    console.error('Error details:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seeding
seedFollowUpDefaults()
  .then(() => {
    console.log('\n🎊 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });

