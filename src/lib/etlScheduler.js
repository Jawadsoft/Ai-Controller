import ETLService from './etlService.js';

class ETLScheduler {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 60000; // Check every minute
    this.intervalId = null;
    this.etlService = new ETLService();
    this.lastCheck = null;
    this.lastExecution = null;
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      console.log('📅 ETL scheduler is already running');
      return;
    }

    console.log('🚀 Starting ETL export scheduler...');
    this.isRunning = true;
    
    // Run immediately on start
    this.processScheduledExports();
    
    // Then run every minute
    this.intervalId = setInterval(() => {
      this.processScheduledExports();
    }, this.checkInterval);

    console.log(`✅ ETL scheduler started (checking every ${this.checkInterval / 1000}s)`);
  }

  // Stop the scheduler
  stop() {
    if (!this.isRunning) {
      console.log('📅 ETL scheduler is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('🛑 ETL scheduler stopped');
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

  // Process scheduled exports
  async processScheduledExports() {
    try {
      this.lastCheck = new Date().toISOString();
      console.log(`🔍 [${new Date().toLocaleTimeString()}] ETL Scheduler checking for due exports...`);
      
      const client = await this.etlService.pool.connect();
      try {
        // Get all active schedules that are due
        const result = await client.query(`
          SELECT 
            ec.id as export_config_id,
            ec.dealer_id,
            ec.config_name,
            ss.id as schedule_id,
            ss.frequency,
            ss.time_hour,
            ss.time_minute,
            ss.day_of_week,
            ss.day_of_month,
            ss.next_run,
            ss.is_active
          FROM etl_export_configs ec
          INNER JOIN etl_schedule_settings ss ON ec.id = ss.export_config_id
          WHERE ec.is_active = true 
            AND ss.is_active = true
            AND ss.next_run <= NOW()
          ORDER BY ss.next_run ASC
        `);

        console.log(`📊 Found ${result.rows.length} export(s) due for execution`);

        if (result.rows.length === 0) {
          console.log('✅ No exports due at this time');
          return;
        }

        for (const schedule of result.rows) {
          try {
            console.log(`🔄 Executing scheduled export: ${schedule.config_name} (ID: ${schedule.export_config_id})`);
            
            // Execute the export
            await this.etlService.executeExport(schedule.export_config_id);
            
            // Update next run time
            await this.etlService.updateNextRunTime(schedule.export_config_id);
            
            this.lastExecution = new Date().toISOString();
            console.log(`✅ Successfully executed export: ${schedule.config_name}`);
          } catch (error) {
            console.error(`❌ Error executing export ${schedule.config_name}:`, error.message);
            console.error('Error stack:', error.stack);
            // Continue with other exports even if one fails
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Error in ETL scheduler:', error);
      console.error('Error stack:', error.stack);
    }
  }
}

export default new ETLScheduler();

