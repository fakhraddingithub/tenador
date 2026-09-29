import mongoose from 'mongoose';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
try {
  if (!process.env.MONGODB_URI_TENADOR) throw new Error('Missing database configuration');
  await mongoose.connect(process.env.MONGODB_URI_TENADOR, { autoIndex: false, maxPoolSize: 1 });
  await mongoose.connection.collection('assistantquotas').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expiresAt_1' });
  console.log('Assistant quota TTL index ready.');
} catch {
  console.error('Could not create the assistant quota index. Check connection and index permissions.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
