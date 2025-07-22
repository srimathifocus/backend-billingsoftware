const express = require('express')
const router = express.Router()
const { protect, adminOnly } = require('../middleware/authMiddleware')
const { registerAdmin, login, forgotPassword, verifyOtp, resetPassword, changePassword, updateProfile } = require('../controllers/authController')

// Allow first admin registration, then protect subsequent registrations
router.post('/register', async (req, res, next) => {
  try {
    const User = require('../models/User')
    const adminCount = await User.countDocuments({ role: 'admin' })
    
    if (adminCount === 0) {
      // First admin can register without authentication
      return registerAdmin(req, res)
    } else {
      // Subsequent registrations require admin authentication
      return protect(req, res, () => {
        return adminOnly(req, res, () => {
          return registerAdmin(req, res)
        })
      })
    }
  } catch (error) {
    return res.status(500).json({ message: 'Server error' })
  }
})
router.post('/login', login)
router.post('/forgot-password', forgotPassword)
router.post('/verify-otp', verifyOtp)
router.post('/reset-password', resetPassword)
router.put('/change-password', protect, changePassword)
router.put('/profile', protect, updateProfile)

module.exports = router