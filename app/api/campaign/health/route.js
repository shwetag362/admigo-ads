const { logger } = require('../../../../lib/logger');
const { prisma } = require('../../../../lib/prisma');

async function GET() {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0',
    checks: {}
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = {
      status: 'up',
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = {
      status: 'down',
      error: error.message
    };
  }

  // Check environment variables
  const requiredEnvVars = [
    'META_APP_SECRET',
    'META_WEBHOOK_VERIFY_TOKEN',
    'ENCRYPTION_KEY'
  ];

  const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
  health.checks.environment = {
    status: missingEnvVars.length === 0 ? 'up' : 'down',
    missing: missingEnvVars
  };

  if (missingEnvVars.length > 0) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;

  return new Response(
    JSON.stringify(health),
    { 
      status: statusCode, 
      headers: { 'Content-Type': 'application/json' } 
    }
  );
}

module.exports = { GET };