const mongoose = require('mongoose');
require('dotenv').config();

const migrateLoanStatus = async () => {
  try {
    console.log('Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pawnshop');
    
    console.log('Connected successfully. Starting loan status migration...');
    
    // Update all loans with status 'inactive' to 'repaid'
    const result = await mongoose.connection.db.collection('loans').updateMany(
      { status: 'inactive' },
      { $set: { status: 'repaid' } }
    );
    
    console.log(`Migration completed successfully!`);
    console.log(`Updated ${result.modifiedCount} loans from 'inactive' to 'repaid'`);
    
    // Verify the changes
    const activeCount = await mongoose.connection.db.collection('loans').countDocuments({ status: 'active' });
    const repaidCount = await mongoose.connection.db.collection('loans').countDocuments({ status: 'repaid' });
    const inactiveCount = await mongoose.connection.db.collection('loans').countDocuments({ status: 'inactive' });
    
    console.log('\nCurrent loan status counts:');
    console.log(`Active loans: ${activeCount}`);
    console.log(`Repaid loans: ${repaidCount}`);
    console.log(`Inactive loans (should be 0): ${inactiveCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateLoanStatus();