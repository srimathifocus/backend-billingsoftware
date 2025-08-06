const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const path = require('path');

// Load environment variables from specific path
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('MONGO_URI loaded:', process.env.MONGO_URI ? 'Yes' : 'No');

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@bs.com' });
    if (existingAdmin) {
      console.log('Admin user already exists!');
      console.log('Email: admin@bs.com');
      console.log('Password: admin123');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create admin user
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@bs.com',
      password: hashedPassword,
      role: 'admin',
      phone: '1234567890',
      department: 'Administration'
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@bs.com');
    console.log('🔑 Password: admin123');
    console.log('');
    console.log('You can now login with these credentials.');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

createAdminUser();