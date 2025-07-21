const User = require('../models/User')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer')

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' })

exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, role = 'admin', phone, department } = req.body
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' })
    }
    
    // Validate role
    if (!['admin', 'manager'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' })
    }
    
    // Check if user already exists
    const existing = await User.findOne({ email })
    if (existing) {
      return res.status(400).json({ message: 'User with this email already exists' })
    }
    
    // Hash password
    const hashed = await bcrypt.hash(password, 10)
    
    // Create user
    const userData = {
      name,
      email,
      password: hashed,
      role
    }
    
    // Add optional fields if provided
    if (phone) userData.phone = phone
    if (department) userData.department = department
    
    const user = await User.create(userData)
    
    // Remove password from response
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      createdAt: user.createdAt
    }
    
    res.json({ 
      token: generateToken(user._id), 
      user: userResponse,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully`
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    res.json({ token: generateToken(user._id), user })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ message: 'User not found' })
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    user.otp = otp
    user.otpExpiry = Date.now() + 10 * 60 * 1000
    await user.save()
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'OTP for Password Reset',
      text: `Your OTP is ${otp}`
    })
    res.json({ message: 'OTP sent' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body
    const user = await User.findOne({ email, otp, otpExpiry: { $gt: Date.now() } })
    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' })
    res.json({ message: 'OTP verified' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body
    const user = await User.findOne({ email, otp, otpExpiry: { $gt: Date.now() } })
    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' })
    user.password = await bcrypt.hash(newPassword, 10)
    user.otp = undefined
    user.otpExpiry = undefined
    await user.save()
    res.json({ message: 'Password reset successfully' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}