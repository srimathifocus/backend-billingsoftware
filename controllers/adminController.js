const User = require('../models/User')
const bcrypt = require('bcryptjs')

exports.addManager = async (req, res) => {
  try {
    const { name, email, password } = req.body
    const existing = await User.findOne({ email })
    if (existing) return res.status(400).json({ message: 'Manager exists' })
    const hashed = await bcrypt.hash(password, 10)
    const manager = await User.create({ name, email, password: hashed, role: 'manager' })
    res.json({ manager })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}


exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password')
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.updateProfile = async (req, res) => {
  try {
    const { name, email, password } = req.body
    const user = await User.findById(req.user.id)
    if (name) user.name = name
    if (email) user.email = email
    if (password) user.password = await bcrypt.hash(password, 10)
    await user.save()
    res.json({ message: 'Profile updated successfully' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.getAllManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: 'manager' }).select('-password')
    res.json(managers)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}