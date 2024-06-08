import postgresql from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = postgresql;

const pool = new Pool({
  user: process.env.DATABASE_USER || 'postgres',
  database: process.env.DATABASE_NAME || 'estateGPT',
  password: process.env.DATABASE_PASSWORD || '',
  host: process.env.DATABASE_HOST || 'localhost',
  port: 5432
});

pool.on('connect', () => {
  console.log('PostgreSQL database connected!');
}).on('error', (err) => {
  // ROLLBACK
  console.log('PostgreSQL database rollback', err);
  pool.query('ROLLBACK');
});

export default pool;