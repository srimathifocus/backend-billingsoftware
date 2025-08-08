// Debug script to check actual transaction dates in database
const mongoose = require('mongoose');
require('dotenv').config({ path: './backend-billingsoftware/.env' });

// Simple transaction schema for testing
const transactionSchema = new mongoose.Schema({
  date: Date,
  type: String,
  mode: String,
  amount: Number
});

const Transaction = mongoose.model('Transaction', transactionSchema);

async function checkTransactionDates() {
  try {
    console.log('🔍 Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database');
    
    console.log('\n📊 Recent transactions in database:');
    const transactions = await Transaction.find({})
      .select('date type mode amount')
      .sort({ date: -1 })
      .limit(10);
    
    transactions.forEach((t, i) => {
      const utcDate = t.date.toISOString();
      const localDate = t.date.toLocaleDateString();
      const dateOnly = utcDate.split('T')[0];
      
      console.log(`${i + 1}. ${utcDate} → ${dateOnly} (${localDate}) - ${t.type} - ₹${t.amount}`);
    });
    
    console.log('\n🎯 Testing date filters:');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    
    console.log(`Today filter (${todayStr}):`);
    const todayStart = new Date(todayStr);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStr);
    todayEnd.setHours(23, 59, 59, 999);
    
    console.log(`  Range: ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);
    
    const todayTransactions = await Transaction.find({
      date: { $gte: todayStart, $lte: todayEnd }
    });
    console.log(`  Found: ${todayTransactions.length} transactions`);
    
    console.log(`\nYesterday filter (${yesterdayStr}):`);
    const yesterdayStart = new Date(yesterdayStr);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEndDate = new Date(yesterdayStr);
    yesterdayEndDate.setHours(23, 59, 59, 999);
    
    console.log(`  Range: ${yesterdayStart.toISOString()} to ${yesterdayEndDate.toISOString()}`);
    
    const yesterdayTransactions = await Transaction.find({
      date: { $gte: yesterdayStart, $lte: yesterdayEndDate }
    });
    console.log(`  Found: ${yesterdayTransactions.length} transactions`);
    
    // Show which dates have transactions
    console.log('\n📅 Dates with transactions:');
    const dateGroups = {};
    transactions.forEach(t => {
      const dateKey = t.date.toISOString().split('T')[0];
      if (!dateGroups[dateKey]) dateGroups[dateKey] = 0;
      dateGroups[dateKey]++;
    });
    
    Object.keys(dateGroups).sort().forEach(date => {
      console.log(`  ${date}: ${dateGroups[date]} transactions`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

checkTransactionDates();