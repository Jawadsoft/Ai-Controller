module.exports = {
  apps: [
    {
      name: 'daive-backend',
      script: 'src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Production settings
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Monitoring
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      // Health check
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'your-git-repo-url',
      path: '/var/www/daive-production',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build:full && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
