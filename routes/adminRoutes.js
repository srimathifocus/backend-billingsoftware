const express = require('express')
const router = express.Router()
const { addManager } = require('../controllers/adminController')
const { protect, isAdmin } = require('../middleware/authMiddleware')
const { getProfile, updateProfile } = require('../controllers/adminController')
const { getAllManagers } = require('../controllers/adminController')

router.post('/add-manager', protect, isAdmin, addManager)
router.get('/managers', protect, isAdmin, getAllManagers)

router.get('/profile', protect, getProfile)
router.put('/profile', protect, updateProfile)
module.exports = router