/**
 * Test script to verify balance persistence
 * Run after starting the server to test that balances are saved and loaded correctly
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbFile = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbFile);

console.log('🔍 Checking balance persistence...\n');

// Test 1: Check if users table exists
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, rows) => {
  if (err) {
    console.error('❌ Error checking tables:', err);
    return;
  }
  if (rows && rows.length > 0) {
    console.log('✅ Users table exists');
  } else {
    console.log('❌ Users table not found');
  }
});

// Test 2: List all users and their balances
console.log('\n📊 Current users and balances:\n');
db.all('SELECT id, first_name, last_name, balance, updated_at FROM users ORDER BY updated_at DESC LIMIT 10', [], (err, rows) => {
  if (err) {
    console.error('❌ Error fetching users:', err);
    db.close();
    return;
  }
  
  if (!rows || rows.length === 0) {
    console.log('ℹ️  No users found in database');
  } else {
    console.log(`Found ${rows.length} users:\n`);
    rows.forEach(user => {
      console.log(`  ID: ${user.id}`);
      console.log(`  Name: ${user.first_name || '-'} ${user.last_name || '-'}`);
      console.log(`  Balance: ${user.balance}`);
      console.log(`  Updated: ${user.updated_at}`);
      console.log('  ---');
    });
  }
  
  db.close();
});

// Test 3: Check database file size
const fs = require('fs');
setTimeout(() => {
  try {
    const stats = fs.statSync(dbFile);
    console.log(`\n📁 Database file size: ${stats.size} bytes`);
  } catch (e) {
    console.log('❌ Database file not found or error:', e.message);
  }
}, 500);
