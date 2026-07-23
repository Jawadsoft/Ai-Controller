import ImportService from './importService333.js';

class ImportScheduler {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 60000; // Check every minute
    this.intervalId = null;
    this.importService = new ImportService();
    this.lastCheck = null;
    this.lastExecution = null;
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      console.log('📅 Import scheduler is already running');
      return;
    }

    console.log('🚀 Starting Import scheduler...');
    this.isRunning = true;
    
    // Run immediately on start
    this.processScheduledImports();
    
    // Then run every minute
    this.intervalId = setInterval(() => {
      this.processScheduledImports();
    }, this.checkInterval);

    console.log(`✅ Import scheduler started (checking every ${this.checkInterval / 1000}s)`);
  }

  // Stop the scheduler
  stop() {
    if (!this.isRunning) {
      console.log('📅 Import scheduler is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('🛑 Import scheduler stopped');
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      lastCheck: this.lastCheck,
      lastExecution: this.lastExecution,
      nextCheckIn: this.isRunning ? `${this.checkInterval / 1000}s` : null
    };
  }

  // Process scheduled imports
  async processScheduledImports() {
    try {
      this.lastCheck = new Date().toISOString();
      console.log(`🔍 [${new Date().toLocaleTimeString()}] Import Scheduler checking for due imports...`);
      
      const client = await this.importService.pool.connect();
      try {
        // Get all active schedules that are due (excluding manual frequency)
        const result = await client.query(`
          SELECT 
            ic.id as import_config_id,
            ic.dealer_id,
            ic.config_name,
            iss.id as schedule_id,
            iss.frequency,
            iss.time_hour,
            iss.time_minute,
            iss.day_of_week,
            iss.day_of_month,
            iss.next_run,
            iss.is_active
          FROM import_configs ic
          INNER JOIN import_schedule_settings iss ON ic.id = iss.import_config_id
          WHERE ic.is_active = true 
            AND iss.is_active = true
            AND iss.frequency NOT IN ('manual')
            AND iss.next_run <= NOW()
          ORDER BY iss.next_run ASC
        `);

        console.log(`📊 Found ${result.rows.length} import(s) due for execution`);

        if (result.rows.length === 0) {
          console.log('✅ No imports due at this time');
          return;
        }

        for (const schedule of result.rows) {
          try {
            console.log(`🔄 Executing scheduled import: ${schedule.config_name} (ID: ${schedule.import_config_id})`);
            
            // Execute the import
            await this.importService.executeImport(schedule.import_config_id);
            
            // Update next run time
            await this.importService.updateNextRunTime(schedule.import_config_id);
            
            this.lastExecution = new Date().toISOString();
            console.log(`✅ Successfully executed import: ${schedule.config_name}`);
          } catch (error) {
            console.error(`❌ Error executing import ${schedule.config_name}:`, error.message);
            console.error('Error stack:', error.stack);
            // Continue with other imports even if one fails
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Error in Import scheduler:', error);
      console.error('Error stack:', error.stack);
    }
  }
}

export default new ImportScheduler();

