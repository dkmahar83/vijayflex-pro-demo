// server/ecosystem.config.js
// PM2 configuration file
// PM2 is baaki backend ko manage karega

module.exports = {
  apps: [
    {
      name: 'vijayflex-backend',
      script: 'index.js',
      cwd: 'C:\\Users\\dkmah\\flex-shop-manager\\server',
      
      // Auto restart agar crash ho
      autorestart: true,
      watch: false,           // Development mein true, production mein false
      
      // Restart settings
      restart_delay: 3000,    // 3 second baad restart
      max_restarts: 10,       // Max 10 restarts
      
      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      
      // Log files
      log_file: 'C:\\Users\\dkmah\\flex-shop-manager\\server\\logs\\combined.log',
      out_file: 'C:\\Users\\dkmah\\flex-shop-manager\\server\\logs\\out.log',
      error_file: 'C:\\Users\\dkmah\\flex-shop-manager\\server\\logs\\error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      
      // Memory limit — restart agar 500MB se zyada use ho
      max_memory_restart: '500M'
    }
  ]
};