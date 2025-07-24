const mongoose = require('mongoose');
require('dotenv').config();

const migrateCustomerStatus = async () => {
  try {
    console.log('Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pawnshop');
    
    console.log('Connected successfully. Starting customer status migration...');
    
    // Since customers don't store loanStatus directly, we just need to ensure
    // the frontend and backend logic handles the status correctly
    console.log('Customer status migration completed - no database changes needed.');
    console.log('Customer loan status is calculated dynamically from loan records.');
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateCustomerStatus();