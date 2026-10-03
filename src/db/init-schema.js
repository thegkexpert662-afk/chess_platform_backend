import fs from 'node:fs/promises';
import { pool } from '../config/db.js';

const schema = await fs.readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8');
await pool.query(schema);
console.log('Database schema is up to date.');
await pool.end();
