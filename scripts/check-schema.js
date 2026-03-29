const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

async function checkSchema() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3333,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jhcisdb'
  };

  let connection;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database\n');

    // Check cdrug table structure
    console.log('📋 cdrug table columns:\n');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cdrug'
      ORDER BY ORDINAL_POSITION
    `, [config.database]);

    console.log('┌──────────────────────────────┬──────────────┬─────────┬──────────┬─────────┐');
    console.log('│ COLUMN_NAME                  │ DATA_TYPE    │ LENGTH  │ NULLABLE │ KEY     │');
    console.log('├──────────────────────────────┼──────────────┼─────────┼──────────┼─────────┤');
    
    for (const col of columns) {
      const name = col.COLUMN_NAME.padEnd(28);
      const type = col.DATA_TYPE.padEnd(12);
      const len = (col.CHARACTER_MAXIMUM_LENGTH || '-').toString().padStart(7);
      const nullable = col.IS_NULLABLE.padEnd(8);
      const key = (col.COLUMN_KEY || '-').padEnd(7);
      console.log(`│ ${name} │ ${type} │ ${len} │ ${nullable} │ ${key} │`);
    }
    console.log('└──────────────────────────────┴──────────────┴─────────┴──────────┴─────────┘\n');

    // Check drugstorereceive structure
    console.log('📋 drugstorereceive table columns:\n');
    const [receiveCols] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'drugstorereceive'
      ORDER BY ORDINAL_POSITION
    `, [config.database]);

    console.log('┌──────────────────────────────┬──────────────┬─────────┬──────────┬─────────┐');
    console.log('│ COLUMN_NAME                  │ DATA_TYPE    │ LENGTH  │ NULLABLE │ KEY     │');
    console.log('├──────────────────────────────┼──────────────┼─────────┼──────────┼─────────┤');
    
    for (const col of receiveCols) {
      const name = col.COLUMN_NAME.padEnd(28);
      const type = col.DATA_TYPE.padEnd(12);
      const len = (col.CHARACTER_MAXIMUM_LENGTH || '-').toString().padStart(7);
      const nullable = col.IS_NULLABLE.padEnd(8);
      const key = (col.COLUMN_KEY || '-').padEnd(7);
      console.log(`│ ${name} │ ${type} │ ${len} │ ${nullable} │ ${key} │`);
    }
    console.log('└──────────────────────────────┴──────────────┴─────────┴──────────┴─────────┘\n');

    // Check drugstorereceivedetail structure
    console.log('📋 drugstorereceivedetail table columns:\n');
    const [detailCols] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'drugstorereceivedetail'
      ORDER BY ORDINAL_POSITION
    `, [config.database]);

    console.log('┌──────────────────────────────┬──────────────┬─────────┬──────────┬─────────┐');
    console.log('│ COLUMN_NAME                  │ DATA_TYPE    │ LENGTH  │ NULLABLE │ KEY     │');
    console.log('├──────────────────────────────┼──────────────┼─────────┼──────────┼─────────┤');
    
    for (const col of detailCols) {
      const name = col.COLUMN_NAME.padEnd(28);
      const type = col.DATA_TYPE.padEnd(12);
      const len = (col.CHARACTER_MAXIMUM_LENGTH || '-').toString().padStart(7);
      const nullable = col.IS_NULLABLE.padEnd(8);
      const key = (col.COLUMN_KEY || '-').padEnd(7);
      console.log(`│ ${name} │ ${type} │ ${len} │ ${nullable} │ ${key} │`);
    }
    console.log('└──────────────────────────────┴──────────────┴─────────┴──────────┴─────────┘\n');

    // Check cdrugremain structure
    console.log('📋 cdrugremain table columns:\n');
    const [remainCols] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cdrugremain'
      ORDER BY ORDINAL_POSITION
    `, [config.database]);

    console.log('┌──────────────────────────────┬──────────────┬─────────┬──────────┬─────────┐');
    console.log('│ COLUMN_NAME                  │ DATA_TYPE    │ LENGTH  │ NULLABLE │ KEY     │');
    console.log('├──────────────────────────────┼──────────────┼─────────┼──────────┼─────────┤');
    
    for (const col of remainCols) {
      const name = col.COLUMN_NAME.padEnd(28);
      const type = col.DATA_TYPE.padEnd(12);
      const len = (col.CHARACTER_MAXIMUM_LENGTH || '-').toString().padStart(7);
      const nullable = col.IS_NULLABLE.padEnd(8);
      const key = (col.COLUMN_KEY || '-').padEnd(7);
      console.log(`│ ${name} │ ${type} │ ${len} │ ${nullable} │ ${key} │`);
    }
    console.log('└──────────────────────────────┴──────────────┴─────────┴──────────┴─────────┘\n');

    // Save to file
    const schema = {
      cdrug: columns,
      drugstorereceive: receiveCols,
      drugstorereceivedetail: detailCols,
      cdrugremain: remainCols
    };
    
    fs.writeFileSync('../table_schemas.json', JSON.stringify(schema, null, 2), 'utf-8');
    console.log('💾 Schema saved to: ../table_schemas.json\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('👋 Connection closed.');
    }
  }
}

checkSchema();
