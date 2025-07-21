const express = require('express')
const router = express.Router()
const { protect, adminOnly } = require('../middleware/authMiddleware')
const { 
  getAllManagers, 
  updateManager, 
  deleteManager, 
  toggleManagerStatus 
} = require('../controllers/userController')

// Get all managers (admin only)
router.get('/managers', protect, adminOnly, getAllManagers)

// Update manager (admin only)
router.put('/managers/:id', protect, adminOnly, updateManager)

// Delete manager (admin only)
router.delete('/managers/:id', protect, adminOnly, deleteManager)

// Toggle manager status (admin only)
router.patch('/managers/:id/status', protect, adminOnly, toggleManagerStatus)

module.exports = router