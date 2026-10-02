import 'dotenv/config';

const required = ['JWT_SECRET', 'DATABASE_URL'];
for (const key of required) {
  if (!process.env[key]) throw new Error('Missing environment variable: ' + key);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean),
};
