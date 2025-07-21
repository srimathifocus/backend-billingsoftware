const express = require('express')
const router = express.Router()
const itemController = require('../controllers/itemController')

// Master item routes (for admin)
router.get('/master', itemController.getMasterItems)
router.post('/', itemController.addItem)
router.get('/', itemController.getAllItems)
router.put('/:id', itemController.updateItem)
router.delete('/:id', itemController.deleteItem)

// Billing item routes
router.post('/billing', itemController.addBillingItem)

module.exports = router
