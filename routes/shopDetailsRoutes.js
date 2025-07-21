const express = require('express')
const router = express.Router()
const shopDetailsController = require('../controllers/shopDetailsController')
const { protect } = require('../middleware/authMiddleware')

// Apply authentication middleware to all routes
router.use(protect)

// GET /api/shop-details - Get shop details
router.get('/', shopDetailsController.getShopDetails)

// PUT /api/shop-details - Update shop details
router.put('/', shopDetailsController.updateShopDetails)

// DELETE /api/shop-details - Delete shop details
router.delete('/', shopDetailsController.deleteShopDetails)

module.exports = router