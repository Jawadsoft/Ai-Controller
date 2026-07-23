import { pool } from './connection.js';

/**
 * DAIVE Follow-Up Default Templates
 * User-friendly, ready-to-use follow-up sequences
 * Idempotent: uses ON CONFLICT DO NOTHING so it can be re-run safely.
 */

async function seedFollowUpDefaults() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Seeding DAIVE Follow-Up default templates...\n');

    await client.query('BEGIN');

    // Add name uniqueness constraint for system defaults if not yet present
    // (safe to run multiple times — catches already-exists error silently)
    await client.query(`
      ALTER TABLE followup_rule_templates
        ADD COLUMN IF NOT EXISTS name_key VARCHAR(100)
    `).catch(() => {});

    // Helper: create a system-default template only if one with the same
    // (name, category, is_system_default) doesn't already exist.
    async function createTemplate(name, description, category) {
      const existing = await client.query(
        `SELECT id FROM followup_rule_templates
         WHERE name = $1 AND category = $2 AND is_system_default = true AND dealer_id IS NULL
         LIMIT 1`,
        [name, category]
      );
      if (existing.rows.length > 0) {
        console.log(`⏭️  Template already exists: ${name}`);
        return existing.rows[0].id;
      }
      const result = await client.query(
        `INSERT INTO followup_rule_templates
           (dealer_id, name, description, category, is_system_default)
         VALUES (NULL, $1, $2, $3, true)
         RETURNING id`,
        [name, description, category]
      );
      return result.rows[0].id;
    }

    // Helper: insert steps only if the template has none yet.
    async function insertStepsIfEmpty(templateId, stepsValues) {
      const count = await client.query(
        `SELECT COUNT(*) AS c FROM followup_steps WHERE rule_template_id = $1`,
        [templateId]
      );
      if (parseInt(count.rows[0].c) > 0) {
        console.log(`⏭️  Steps already exist for template ${templateId}, skipping`);
        return;
      }
      await client.query(stepsValues.sql, [templateId, ...stepsValues.params]);
    }

    // ============================================
    // TEMPLATE 1: HOT LEAD NURTURE (7-Day Sequence)
    // ============================================
    console.log('📝 Template 1: Hot Lead 7-Day Nurture...');
    const hotLeadId = await createTemplate(
      'Hot Lead 7-Day Nurture',
      'Aggressive follow-up for highly interested leads',
      'lead_nurture'
    );
    await insertStepsIfEmpty(hotLeadId, {
      sql: `INSERT INTO followup_steps
        (rule_template_id, step_order, step_name, delay_days, delay_hours, delay_minutes, channel, subject_template, message_template) VALUES
        ($1, 1, 'Immediate Follow-Up', 0, 0, 5, 'sms', NULL, $2),
        ($1, 2, 'Same Day Email',      0, 4, 0, 'email', $3, $4),
        ($1, 3, 'Day 2 Check-In',      1, 0, 0, 'sms',   NULL, $5),
        ($1, 4, 'Day 3 Incentive',     2, 0, 0, 'email', $6, $7),
        ($1, 5, 'Day 5 Urgency',       4, 0, 0, 'sms',   NULL, $8),
        ($1, 6, 'Day 7 Final Push',    6, 0, 0, 'email', $9, $10)`,
      params: [
        `Hi {{customer_name}}! Thanks for your interest in a vehicle. I'm holding it for you - when can you come see it? Reply YES to schedule today!`,
        `Your vehicle is waiting!`,
        `Hi {{customer_name}},\n\nGreat news! The vehicle you inquired about is still available.\n\nHere's what makes it special:\n✓ Excellent condition\n✓ Competitive pricing\n✓ Financing available\n✓ Ready for immediate delivery\n\nCan I answer any questions?\n\nBest regards,\nYour DAIVE Team`,
        `Hi {{customer_name}}! Just checking in - still interested? We have people looking at it. Should I hold it for you?`,
        `Special offer for {{customer_name}}`,
        `Hi {{customer_name}},\n\nI wanted to personally reach out about the vehicle you were interested in.\n\n🎁 SPECIAL OFFER (This Week Only):\n- $500 additional discount\n- Free first oil change\n- Extended warranty option\n\nReady to move forward? Let's schedule your visit!\n\nBest regards,\nYour DAIVE Team`,
        `Hi {{customer_name}}! The vehicle you liked has serious buyers - it won't last through the weekend. Want me to reserve it? Reply YES.`,
        `Last chance on your vehicle`,
        `Hi {{customer_name}},\n\nThis is your LAST CHANCE to get:\n→ The vehicle you wanted\n→ Our special pricing\n→ Priority scheduling\n\nCan we schedule a quick call? I'm here until 7 PM today.\n\nBest regards,\nYour DAIVE Team`
      ]
    });
    console.log('✅ Hot Lead template ready\n');

    // ============================================
    // TEMPLATE 2: WARM LEAD NURTURE (14-Day Sequence)
    // ============================================
    console.log('📝 Template 2: Warm Lead 14-Day Nurture...');
    const warmLeadId = await createTemplate(
      'Warm Lead 14-Day Nurture',
      'Steady follow-up for interested but not urgent leads',
      'lead_nurture'
    );
    await insertStepsIfEmpty(warmLeadId, {
      sql: `INSERT INTO followup_steps
        (rule_template_id, step_order, step_name, delay_days, delay_hours, delay_minutes, channel, subject_template, message_template) VALUES
        ($1, 1, 'Welcome Message',  0,  2, 0, 'email', $2, $3),
        ($1, 2, 'Day 3 Check-In',  3,  0, 0, 'sms',   NULL, $4),
        ($1, 3, 'Day 7 Value Prop', 7,  0, 0, 'email', $5, $6),
        ($1, 4, 'Day 14 Final',    14,  0, 0, 'sms',   NULL, $7)`,
      params: [
        `Thanks for your interest!`,
        `Hi {{customer_name}},\n\nThank you for reaching out! I'd love to help you find the perfect vehicle.\n\nHere's what happens next:\n1. Review your options\n2. Answer any questions\n3. Schedule a no-pressure test drive\n4. Explore financing options\n\nWhat questions can I answer for you?\n\nBest regards,\nYour DAIVE Team`,
        `Hi {{customer_name}}! Still thinking about your vehicle? I'm here if you have any questions. Just reply!`,
        `Why choose us?`,
        `Hi {{customer_name}},\n\nI wanted to share why customers love working with us:\n\n⭐ 4.9/5 customer rating\n💰 Best price guarantee\n🚗 Largest selection in the area\n✅ No-pressure environment\n\nReady to take the next step?\n\nBest regards,\nYour DAIVE Team`,
        `Hi {{customer_name}}! Hope you're doing well. We still have great vehicles available - would you like to schedule a visit?`
      ]
    });
    console.log('✅ Warm Lead template ready\n');

    // ============================================
    // TEMPLATE 3: UNSOLD VISIT RECOVERY (30-Day Sequence)
    // ============================================
    console.log('📝 Template 3: Unsold Visit Recovery...');
    const unsoldId = await createTemplate(
      'Unsold Visit Recovery',
      "Win back customers who visited but didn't purchase",
      'unsold_visit'
    );
    await insertStepsIfEmpty(unsoldId, {
      sql: `INSERT INTO followup_steps
        (rule_template_id, step_order, step_name, delay_days, delay_hours, delay_minutes, channel, subject_template, message_template) VALUES
        ($1, 1, 'Same Day Thank You',  0,  4, 0, 'email', $2, $3),
        ($1, 2, '48-Hour Check-In',    2,  0, 0, 'sms',   NULL, $4),
        ($1, 3, 'Week 1 Comparison',   7,  0, 0, 'email', $5, $6),
        ($1, 4, 'Week 2 Incentive',   14,  0, 0, 'sms',   NULL, $7),
        ($1, 5, 'Week 3 Alternatives', 21, 0, 0, 'email', $8, $9),
        ($1, 6, 'Month End Final',     30, 0, 0, 'sms',   NULL, $10)`,
      params: [
        `Great meeting you today!`,
        `Hi {{customer_name}},\n\nIt was wonderful meeting you today! Thanks for taking the time to visit us.\n\nI know you mentioned wanting to think it over - that's completely understandable!\n\nIf any questions come up, I'm just a text/call away.\n\nBest regards,\nYour DAIVE Team`,
        `Hi {{customer_name}}! Hope you're well. Have you made a decision about the vehicle? I'm here to help if you have questions!`,
        `How does it compare?`,
        `Hi {{customer_name}},\n\nHow is the vehicle comparing to others you've looked at?\n\nCommon concerns I can help with:\n→ Pricing/payments\n→ Trade-in value\n→ Specific features\n→ Timing\n\nWhat's your main consideration right now?\n\nBest regards,\nYour DAIVE Team`,
        `Hi {{customer_name}}! Good news - we just got approved for additional rebates. Want to know how much you can save? Call me!`,
        `Found vehicles you might love`,
        `Hi {{customer_name}},\n\nI found other vehicles that match what you're looking for. Any catch your eye? I can get you behind the wheel this week.\n\nBest regards,\nYour DAIVE Team`,
        `Hi {{customer_name}}! End of month - best time for deals. I can offer you an amazing price right now. Interested?`
      ]
    });
    console.log('✅ Unsold Visit template ready\n');

    // ============================================
    // TEMPLATE 4: POST-PURCHASE ONBOARDING (30-Day Sequence)
    // ============================================
    console.log('📝 Template 4: Post-Purchase Onboarding...');
    const postPurchaseId = await createTemplate(
      'Post-Purchase Onboarding',
      'Welcome new customers and build loyalty',
      'post_purchase'
    );
    await insertStepsIfEmpty(postPurchaseId, {
      sql: `INSERT INTO followup_steps
        (rule_template_id, step_order, step_name, delay_days, delay_hours, delay_minutes, channel, subject_template, message_template) VALUES
        ($1, 1, 'Immediate Thank You',   0,  0, 30, 'email', $2, $3),
        ($1, 2, 'Day 3 Check-In',        3,  0,  0, 'sms',   NULL, $4),
        ($1, 3, 'Day 7 Review Request',  7,  0,  0, 'email', $5, $6),
        ($1, 4, 'Day 14 Referral',      14,  0,  0, 'sms',   NULL, $7),
        ($1, 5, 'Day 30 Service',        30, 0,  0, 'email', $8, $9)`,
      params: [
        `🎉 Welcome to the family!`,
        `Hi {{customer_name}},\n\nCongratulations on your new vehicle! We're thrilled to have you as part of our family.\n\nHere's what you need to know:\n\n🔧 Your first oil change is FREE (within 5,000 miles)\n⭐ Join our VIP rewards program\n📞 24/7 roadside assistance available\n\nEnjoy your new ride!\n\nWelcome to the family,\nYour DAIVE Team`,
        `Hi {{customer_name}}! How are you loving your new vehicle? Any questions about features or settings? I'm here to help!`,
        `How was your experience?`,
        `Hi {{customer_name}},\n\nHope you're enjoying your new vehicle!\n\nWould you mind sharing your experience? It takes just 2 minutes and helps other customers.\n\nAs a thank you, we'll enter you to win a $100 gift card!\n\nThank you,\nYour DAIVE Team`,
        `Hi {{customer_name}}! Know anyone looking for a vehicle? Refer a friend and you BOTH get $250! Just have them mention your name.`,
        `Time for your first service!`,
        `Hi {{customer_name}},\n\nYour vehicle is ready for its first check-up!\n\n🎁 Don't forget - your first oil change is FREE!\n\nWe'll:\n✓ Change oil & filter\n✓ Check all fluids\n✓ Inspect brakes\n✓ Complete car wash\n\nTakes about 45 minutes. We have coffee and WiFi!\n\nSee you soon,\nYour DAIVE Team`
      ]
    });
    console.log('✅ Post-Purchase template ready\n');

    // ============================================
    // TEMPLATE 5: SERVICE CUSTOMER REMINDERS
    // ============================================
    console.log('📝 Template 5: Service Customer Reminders...');
    const serviceId = await createTemplate(
      'Service Customer Reminders',
      'Keep service customers coming back',
      'service_customer'
    );
    await insertStepsIfEmpty(serviceId, {
      sql: `INSERT INTO followup_steps
        (rule_template_id, step_order, step_name, delay_days, delay_hours, delay_minutes, channel, subject_template, message_template) VALUES
        ($1, 1, '3-Month Reminder',  90,  0, 0, 'email', $2, $3),
        ($1, 2, '6-Month Check-In', 180,  0, 0, 'sms',   NULL, $4),
        ($1, 3, 'Seasonal Service',  270, 0, 0, 'email', $5, $6)`,
      params: [
        `Time for service?`,
        `Hi {{customer_name}},\n\nIt's been about 3 months - is your vehicle due for:\n→ Oil change\n→ Tire rotation\n→ Brake inspection\n\nWe'll get you in and out quickly!\n\nBest regards,\nYour DAIVE Service Team`,
        `Hi {{customer_name}}! Your vehicle is due for its 6-month service. Schedule online anytime - link in your email!`,
        `Prepare your vehicle for the season`,
        `Hi {{customer_name}},\n\nTime to prepare your vehicle for the season!\n\nRecommended service:\n✓ Battery test\n✓ Tire inspection\n✓ Fluid check\n✓ Climate control service\n\nKeep your vehicle running great year-round!\n\nBest regards,\nYour DAIVE Service Team`
      ]
    });
    console.log('✅ Service Customer template ready\n');

    // ============================================
    // TEMPLATE 6: AT-RISK RE-ENGAGEMENT
    // ============================================
    console.log('📝 Template 6: At-Risk Re-Engagement...');
    const atRiskId = await createTemplate(
      'At-Risk Re-Engagement',
      'Re-engage customers showing low engagement',
      'at_risk'
    );
    await insertStepsIfEmpty(atRiskId, {
      sql: `INSERT INTO followup_steps
        (rule_template_id, step_order, step_name, delay_days, delay_hours, delay_minutes, channel, subject_template, message_template) VALUES
        ($1, 1, 'Check-In', 0, 2, 0, 'email', $2, $3),
        ($1, 2, 'Special Offer', 7, 0, 0, 'sms', NULL, $4),
        ($1, 3, 'Final Reach-Out', 14, 0, 0, 'email', $5, $6)`,
      params: [
        `We miss you, {{customer_name}}!`,
        `Hi {{customer_name}},\n\nWe noticed it's been a while since we connected. We'd love to help you find the right vehicle!\n\nIs there anything we can do better? Your feedback matters to us.\n\nBest regards,\nYour DAIVE Team`,
        `Hi {{customer_name}}! We'd love to earn your business. We have a special offer just for you - reply for details!`,
        `One last thing, {{customer_name}}`,
        `Hi {{customer_name}},\n\nWe understand timing isn't always right. When you're ready, we'll be here with:\n✓ Our best pricing\n✓ No-pressure experience\n✓ Full financing support\n\nJust reach out anytime.\n\nBest regards,\nYour DAIVE Team`
      ]
    });
    console.log('✅ At-Risk template ready\n');

    // ============================================
    // TEMPLATE 7: CHURN PREVENTION (Win-Back)
    // ============================================
    console.log('📝 Template 7: Churn Prevention Win-Back...');
    const churnId = await createTemplate(
      'Churn Prevention Win-Back',
      'Win back customers who have gone silent',
      'churn_prevention'
    );
    await insertStepsIfEmpty(churnId, {
      sql: `INSERT INTO followup_steps
        (rule_template_id, step_order, step_name, delay_days, delay_hours, delay_minutes, channel, subject_template, message_template) VALUES
        ($1, 1, 'We miss you',       0,  2, 0, 'email', $2, $3),
        ($1, 2, '30-Day Offer',     30,  0, 0, 'sms',   NULL, $4),
        ($1, 3, '60-Day Last Try',  60,  0, 0, 'email', $5, $6),
        ($1, 4, '90-Day Final',     90,  0, 0, 'sms',   NULL, $7)`,
      params: [
        `We miss you, {{customer_name}}`,
        `Hi {{customer_name}},\n\nIt's been a while and we miss you! Is there anything we could have done better?\n\nWe're constantly improving and your feedback helps us serve customers like you.\n\nBest regards,\nYour DAIVE Team`,
        `Hi {{customer_name}}! We have an exclusive win-back offer just for you. Come see us this month for special pricing. Interested?`,
        `A special offer, just for you`,
        `Hi {{customer_name}},\n\nWe put together an exclusive offer for you:\n\n🎁 $750 loyalty discount\n🔧 Free first service\n💰 Best financing rates\n\nThis offer is only available for a limited time.\n\nBest regards,\nYour DAIVE Team`,
        `Hi {{customer_name}}! Last chance for our exclusive offer. We'd love to have you back. Reply YES to learn more.`
      ]
    });
    console.log('✅ Churn Prevention template ready\n');

    // ============================================
    // TEMPLATE 8: LONG-TERM LOYALTY
    // ============================================
    console.log('📝 Template 8: Long-Term Loyalty...');
    const loyaltyId = await createTemplate(
      'Long-Term Loyalty',
      'Quarterly check-ins, holidays, and purchase anniversaries',
      'long_term_loyalty'
    );
    await insertStepsIfEmpty(loyaltyId, {
      sql: `INSERT INTO followup_steps
        (rule_template_id, step_order, step_name, delay_days, delay_hours, delay_minutes, channel, subject_template, message_template) VALUES
        ($1, 1, '90-Day Check-In',    90,  0, 0, 'email', $2, $3),
        ($1, 2, '6-Month Trade-In',  180,  0, 0, 'sms',   NULL, $4),
        ($1, 3, '1-Year Anniversary', 365, 0, 0, 'email', $5, $6),
        ($1, 4, 'Holiday Greeting',  330,  0, 0, 'sms',   NULL, $7)`,
      params: [
        `How are you enjoying your vehicle?`,
        `Hi {{customer_name}},\n\nHope you're loving your vehicle! Just checking in after 3 months.\n\nHave you tried all the features? Let us know if you need any help.\n\nBest regards,\nYour DAIVE Team`,
        `Hi {{customer_name}}! Did you know your vehicle may have trade-in value? Vehicles are selling at great prices right now. Curious what yours is worth?`,
        `Happy 1-Year Anniversary, {{customer_name}}! 🎉`,
        `Hi {{customer_name}},\n\nCan you believe it's been a year already?! 🎉\n\nThank you for being part of our family. As a loyalty reward:\n✓ Priority service scheduling\n✓ 10% service discount this month\n✓ Exclusive trade-in bonus if you're ready to upgrade\n\nBest regards,\nYour DAIVE Team`,
        `Hi {{customer_name}}! Wishing you and your family a wonderful holiday season. Thank you for being a valued customer! 🎄`
      ]
    });
    console.log('✅ Long-Term Loyalty template ready\n');

    await client.query('COMMIT');

    console.log('\n🎉 SUCCESS! Default templates ready:');
    console.log('   1. Hot Lead 7-Day Nurture          (lead_nurture)');
    console.log('   2. Warm Lead 14-Day Nurture         (lead_nurture)');
    console.log('   3. Unsold Visit Recovery            (unsold_visit)');
    console.log('   4. Post-Purchase Onboarding         (post_purchase)');
    console.log('   5. Service Customer Reminders       (service_customer)');
    console.log('   6. At-Risk Re-Engagement            (at_risk)');
    console.log('   7. Churn Prevention Win-Back        (churn_prevention)');
    console.log('   8. Long-Term Loyalty                (long_term_loyalty)');
    console.log('\n✅ All 8 categories covered');
    console.log('\n📝 Next steps:');
    console.log('   1. Access settings at: /followup/settings');
    console.log('   2. Configure email/SMS credentials in .env');
    console.log('   3. Enable the system via the Master Switch');
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

