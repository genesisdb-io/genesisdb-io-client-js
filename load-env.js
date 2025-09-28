// Simple environment variable loader for Node.js tests
// Since we're not using external dependencies, this is a minimal implementation
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');

  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const envVars = envFile.split('\n')
      .filter(line => line && !line.startsWith('#'))
      .map(line => line.split('='))
      .filter(([key, value]) => key && value);

    envVars.forEach(([key, value]) => {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });

    console.log(`Loaded ${envVars.length} environment variables from .env file`);
  }
}

loadEnv();