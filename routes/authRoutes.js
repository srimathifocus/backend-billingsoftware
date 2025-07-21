const express = require('express')
const router = express.Router()
const { protect, adminOnly } = require('../middleware/authMiddleware')
const { registerAdmin, login, forgotPassword, verifyOtp, resetPassword } = require('../controllers/authController')

router.post('/register', protect, adminOnly, registerAdmin)
router.post('/login', login)
router.post('/forgot-password', forgotPassword)
router.post('/verify-otp', verifyOtp)
router.post('/reset-password', resetPassword)

module.exports = router