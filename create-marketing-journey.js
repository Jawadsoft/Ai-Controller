// Marketing Journey Creator - Reusable Script
// Run this file to create marketing journeys with steps in the database
// Usage: node create-marketing-journey.js

import { pool } from './src/database/connection.js';

async function createMarketingJourney() {
  console.log('🚀 Marketing Journey Creator\n');
  
  try {
    // Get the Super Admin user ID
    const userResult = await pool.query(`
      SELECT id FROM users 
      WHERE email = 'admin@mitiesoft.com' 
      LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Super Admin user not found. Please run the migration first.');
      return;
    }
    
    const superAdminId = userResult.rows[0].id;
    console.log(`✅ Found Super Admin user: ${superAdminId}`);
    
    // Configuration - Modify these values as needed
    const journeyConfig = {
      name: 'Welcome Series',
      description: 'A comprehensive welcome sequence for new leads with educational content and engagement',
      is_active: true
    };
    
    // Create the marketing journey
    console.log('\n📧 Creating Marketing Journey...');
    const journeyResult = await pool.query(`
      INSERT INTO marketing_journeys (name, description, is_active, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, description, is_active, created_at
    `, [
      journeyConfig.name,
      journeyConfig.description,
      journeyConfig.is_active,
      superAdminId
    ]);
    
    const journey = journeyResult.rows[0];
    console.log(`✅ Created journey: ${journey.name} (ID: ${journey.id})`);
    
    // Journey steps configuration - Modify these as needed
    const stepsConfig = [
      {
        step_order: 1,
        channel: 'email',
        delay_minutes: 0, // Immediate
        template_subject: 'Welcome to Our Platform! 🎉',
        template_body: `Hi {{name}},

Welcome to our platform! We're excited to have you on board.

In this email series, we'll help you:
• Get started with our platform
• Learn about key features
• Maximize your success

Best regards,
The Team`
      },
      {
        step_order: 2,
        channel: 'email',
        delay_minutes: 60, // 1 hour later
        template_subject: 'Getting Started: Your First Steps',
        template_body: `Hi {{name}},

Now that you're here, let's get you started! Here are your first steps:

1. Complete your profile setup
2. Explore our dashboard
3. Connect your first integration

Need help? Reply to this email and we'll assist you.

Best regards,
The Team`
      },
      {
        step_order: 3,
        channel: 'email',
        delay_minutes: 1440, // 1 day later
        template_subject: 'Pro Tips: Maximize Your Success',
        template_body: `Hi {{name}},

Ready for some pro tips? Here are advanced strategies to maximize your success:

💡 **Tip 1**: Set up automated workflows
💡 **Tip 2**: Use our analytics dashboard
💡 **Tip 3**: Join our community forum

These features will help you get the most out of our platform.

Best regards,
The Team`
      },
      {
        step_order: 4,
        channel: 'email',
        delay_minutes: 2880, // 2 days later
        template_subject: 'How Are You Doing? Let Us Know!',
        template_body: `Hi {{name}},

We hope you're enjoying our platform! We'd love to hear about your experience so far.

Quick question: How has your experience been?

• ⭐⭐⭐⭐⭐ Excellent
• ⭐⭐⭐⭐ Good  
• ⭐⭐⭐ Average
• ⭐⭐ Below expectations
• ⭐ Poor

Your feedback helps us improve. Reply with your rating or any questions!

Best regards,
The Team`
      },
      {
        step_order: 5,
        channel: 'email',
        delay_minutes: 4320, // 3 days later
        template_subject: 'Final Welcome: You\'re All Set!',
        template_body: `Hi {{name}},

Congratulations! You've completed our welcome series. You're now fully set up and ready to succeed.

Here's what you can do next:
• Explore advanced features
• Join our weekly webinars
• Connect with other users

Thank you for choosing our platform!

Best regards,
The Team`
      }
    ];
    
    // Create journey steps
    console.log('\n📝 Creating Journey Steps...');
    
    for (const step of stepsConfig) {
      const stepResult = await pool.query(`
        INSERT INTO marketing_journey_steps (
          journey_id, step_order, channel, delay_minutes, 
          template_subject, template_body, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, step_order, channel, delay_minutes, template_subject
      `, [
        journey.id,
        step.step_order,
        step.channel,
        step.delay_minutes,
        step.template_subject,
        step.template_body,
        true
      ]);
      
      const createdStep = stepResult.rows[0];
      console.log(`✅ Created step ${createdStep.step_order}: ${createdStep.template_subject}`);
    }
    
    // Sample leads configuration - Modify these as needed
    const sampleLeadsConfig = [
      {
        full_name: 'John Smith',
        email: 'john.smith@example.com',
        phone: '+1-555-0123',
        company: 'Tech Corp',
        source: 'website',
        status: 'new',
        tags: ['prospect', 'tech'],
        notes: 'Interested in automation features'
      },
      {
        full_name: 'Sarah Johnson',
        email: 'sarah.j@example.com',
        phone: '+1-555-0124',
        company: 'Marketing Plus',
        source: 'referral',
        status: 'new',
        tags: ['referral', 'marketing'],
        notes: 'Referred by existing customer'
      },
      {
        full_name: 'Mike Chen',
        email: 'mike.chen@example.com',
        phone: '+1-555-0125',
        company: 'StartupXYZ',
        source: 'social',
        status: 'new',
        tags: ['startup', 'social'],
        notes: 'Found us on LinkedIn'
      }
    ];
    
    // Create sample leads
    console.log('\n👥 Creating Sample Leads...');
    
    const createdLeads = [];
    for (const leadData of sampleLeadsConfig) {
      const leadResult = await pool.query(`
        INSERT INTO software_leads (
          created_by, full_name, email, phone, company, 
          source, status, tags, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, full_name, email, company
      `, [
        superAdminId,
        leadData.full_name,
        leadData.email,
        leadData.phone,
        leadData.company,
        leadData.source,
        leadData.status,
        leadData.tags,
        leadData.notes
      ]);
      
      const createdLead = leadResult.rows[0];
      createdLeads.push(createdLead);
      console.log(`✅ Created lead: ${createdLead.full_name} (${createdLead.email})`);
    }
    
    // Enroll leads in the journey
    console.log('\n🎯 Enrolling Leads in Journey...');
    
    for (const lead of createdLeads) {
      const enrollmentResult = await pool.query(`
        INSERT INTO marketing_enrollments (
          lead_id, journey_id, status, current_step_order, next_run_at
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, current_step_order, next_run_at
      `, [
        lead.id,
        journey.id,
        'active',
        0, // Start at step 0 (will move to step 1 when processed)
        new Date() // Run immediately
      ]);
      
      const enrollment = enrollmentResult.rows[0];
      console.log(`✅ Enrolled ${lead.full_name} in journey (Enrollment ID: ${enrollment.id})`);
    }
    
    // Summary
    console.log('\n🎉 Marketing Journey Created Successfully!');
    console.log('\n📊 Summary:');
    console.log(`• Journey: ${journey.name}`);
    console.log(`• Steps: ${stepsConfig.length} email steps`);
    console.log(`• Leads: ${createdLeads.length} sample leads enrolled`);
    console.log(`• Status: Active and ready to process`);
    
    console.log('\n🚀 Next Steps:');
    console.log('1. The marketing scheduler will automatically process these enrollments');
    console.log('2. Emails will be sent according to the delay schedule');
    console.log('3. Check the Super Admin Marketing tab to monitor progress');
    console.log('4. View enrollments and send status in the dashboard');
    
    console.log('\n📧 Email Schedule:');
    console.log('• Step 1: Immediate (Welcome)');
    console.log('• Step 2: 1 hour later (Getting Started)');
    console.log('• Step 3: 1 day later (Pro Tips)');
    console.log('• Step 4: 2 days later (Feedback Request)');
    console.log('• Step 5: 3 days later (Final Welcome)');
    
    console.log('\n💡 To customize this journey:');
    console.log('1. Edit the journeyConfig object above');
    console.log('2. Modify the stepsConfig array for different steps');
    console.log('3. Update the sampleLeadsConfig array for different leads');
    console.log('4. Run this script again: node create-marketing-journey.js');
    
  } catch (error) {
    console.error('❌ Error creating marketing journey:', error);
  } finally {
    await pool.end();
  }
}

// Run the function
createMarketingJourney();
