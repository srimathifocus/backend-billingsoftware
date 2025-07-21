const User = require('../models/User')
const bcrypt = require('bcryptjs')

// Get all managers
exports.getAllManagers = async (req, res) => {
  try {
    const managers = await User.find({})
      .select('-password -otp -otpExpiry')
      .sort({ createdAt: -1 })
    
    res.json(managers)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Update manager
exports.updateManager = async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, phone, department, role } = req.body
    
    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' })
    }
    
    // Validate role
    if (role && !['admin', 'manager'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' })
    }
    
    // Check if user exists
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ message: 'Manager not found' })
    }
    
    // Check if email is already taken by another user
    const existingUser = await User.findOne({ email, _id: { $ne: id } })
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use by another user' })
    }
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { name, email, phone, department, role },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpiry')
    
    res.json(updatedUser)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Delete manager
exports.deleteManager = async (req, res) => {
  try {
    const { id } = req.params
    
    // Check if user exists
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ message: 'Manager not found' })
    }
    
    // Prevent deletion of the last admin
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' })
      if (adminCount <= 1) {
        return res.status(400).json({ 
          message: 'Cannot delete the last admin user' 
        })
      }
    }
    
    // Delete user
    await User.findByIdAndDelete(id)
    
    res.json({ message: 'Manager deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Toggle manager status (activate/deactivate)
exports.toggleManagerStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { isActive } = req.body
    
    // Check if user exists
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ message: 'Manager not found' })
    }
    
    // Prevent deactivation of the last admin
    if (user.role === 'admin' && isActive === false) {
      const activeAdminCount = await User.countDocuments({ 
        role: 'admin', 
        isActive: { $ne: false } 
      })
      if (activeAdminCount <= 1) {
        return res.status(400).json({ 
          message: 'Cannot deactivate the last active admin' 
        })
      }
    }
    
    // Update user status
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpiry')
    
    res.json(updatedUser)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}