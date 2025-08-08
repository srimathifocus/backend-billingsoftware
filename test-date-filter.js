// Quick test script to debug date filtering
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to database
mongoose.connect(process.env.MONGO_URI);

const Transaction = require('./models/transactionsModel');

async function testDateFiltering() {
  try {
    console.log('🔍 Testing Date Filtering...');
    console.log('Current time:', new Date().toISOString());
    console.log('Current local time:', new Date().toLocaleString());
    
    // Get all transactions to see what dates we have
    const allTransactions = await Transaction.find({})
      .select('date type mode amount')
      .sort({ date: -1 })
      .limit(10);
    
    console.log('\n📊 Recent transactions in database:');
    allTransactions.forEach((t, i) => {
      console.log(`${i + 1}. ${t.date.toISOString()} (${t.date.toLocaleDateString()}) - ${t.type} - ₹${t.amount}`);
    });
    
    // Test today's filter
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`\n🎯 Testing "Today" filter: ${todayStr}`);
    
    const start = new Date(todayStr);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(todayStr);
    end.setHours(23, 59, 59, 999);
    
    console.log('Filter range:');
    console.log('  Start:', start.toISOString(), '(', start.toLocaleString(), ')');
    console.log('  End:', end.toISOString(), '(', end.toLocaleString(), ')');
    
    const todayTransactions = await Transaction.find({
      date: {
        $gte: start,
        $lte: end
      }
    });
    
    console.log(`\n✅ Found ${todayTransactions.length} transactions for today`);
    todayTransactions.forEach((t, i) => {
      console.log(`${i + 1}. ${t.date.toISOString()} - ${t.type} - ₹${t.amount}`);
    });
    
    // Test yesterday's filter
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    console.log(`\n🎯 Testing "Yesterday" filter: ${yesterdayStr}`);
    
    const yStart = new Date(yesterdayStr);
    yStart.setHours(0, 0, 0, 0);
    
    const yEnd = new Date(yesterdayStr);
    yEnd.setHours(23, 59, 59, 999);
    
    const yesterdayTransactions = await Transaction.find({
      date: {
        $gte: yStart,
        $lte: yEnd
      }
    });
    
    console.log(`\n✅ Found ${yesterdayTransactions.length} transactions for yesterday`);
    yesterdayTransactions.forEach((t, i) => {
      console.log(`${i + 1}. ${t.date.toISOString()} - ${t.type} - ₹${t.amount}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

testDateFiltering();