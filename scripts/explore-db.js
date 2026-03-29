// Load .env manually
const fs = require('fs');
const path = require('path');
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

// Load mysql2 from backend/node_modules
const mysql = require('../backend/node_modules/mysql2/promise');

async function exploreDatabase() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3333,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jhcisdb'
  };

  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   Database: ${config.database}`);
    console.log(`   User: ${config.user}`);
    console.log('');

    connection = await mysql.createConnection(config);
    console.log('✅ Connected successfully!\n');

    // Get all tables
    console.log('📋 Fetching tables...\n');
    const [tables] = await connection.query(`
      SELECT TABLE_NAME, TABLE_ROWS, TABLE_COMMENT 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      ORDER BY TABLE_NAME
    `, [config.database]);

    console.log(`📊 Found ${tables.length} tables:\n`);
    console.log('┌─────────────────────────────────┬────────────┬─────────────────────────┐');
    console.log('│ TABLE_NAME                      │ ROWS       │ COMMENT                 │');
    console.log('├─────────────────────────────────┼────────────┼─────────────────────────┤');
    
    for (const table of tables) {
      const name = table.TABLE_NAME.padEnd(31);
      const rows = (table.TABLE_ROWS || 0).toString().padStart(10);
      const comment = (table.TABLE_COMMENT || '').substring(0, 23).padEnd(23);
      console.log(`│ ${name} │ ${rows} │ ${comment} │`);
    }
    console.log('└─────────────────────────────────┴────────────┴─────────────────────────┘\n');

    // Group tables by prefix
    console.log('📁 Tables by prefix:\n');
    const prefixes = {};
    for (const table of tables) {
      const name = table.TABLE_NAME;
      const prefix = name.split('_')[0] || name;
      if (!prefixes[prefix]) prefixes[prefix] = [];
      prefixes[prefix].push(name);
    }

    for (const [prefix, tableList] of Object.entries(prefixes).sort((a, b) => b[1].length - a[1].length)) {
      if (tableList.length >= 3) {
        console.log(`  ${prefix}: ${tableList.length} tables`);
        tableList.slice(0, 5).forEach(t => console.log(`    - ${t}`));
        if (tableList.length > 5) console.log(`    ... and ${tableList.length - 5} more`);
        console.log('');
      }
    }

    // Save to JSON file
    const fs = require('fs');
    const outputPath = '../db_schema_analysis.json';
    const analysis = {
      timestamp: new Date().toISOString(),
      database: config.database,
      totalTables: tables.length,
      tables: tables.map(t => ({
        name: t.TABLE_NAME,
        rows: t.TABLE_ROWS,
        comment: t.TABLE_COMMENT
      }))
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2), 'utf-8');
    console.log(`💾 Schema analysis saved to: ${outputPath}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   → Cannot connect to database. Is MySQL running on port 3333?');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   → Access denied. Check username/password.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('   → Database does not exist.');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('👋 Connection closed.');
    }
  }
}

exploreDatabase();
