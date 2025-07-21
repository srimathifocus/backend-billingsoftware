const ShopDetails = require('../models/ShopDetails')

// Get shop details
exports.getShopDetails = async (req, res) => {
  try {
    let shopDetails = await ShopDetails.findOne({ isActive: true })
    
    // If no shop details exist, create default one
    if (!shopDetails) {
      shopDetails = new ShopDetails({})
      await shopDetails.save()
    }

    res.json({
      success: true,
      data: shopDetails
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Create or update shop details
exports.updateShopDetails = async (req, res) => {
  try {
    const {
      shopName,
      address,
      phone,
      email,
      gstNumber,
      licenseNumber,
      location,
      auditorName
    } = req.body

    let shopDetails = await ShopDetails.findOne({ isActive: true })

    if (shopDetails) {
      // Update existing shop details
      shopDetails.shopName = shopName || shopDetails.shopName
      shopDetails.address = address || shopDetails.address
      shopDetails.phone = phone || shopDetails.phone
      shopDetails.email = email || shopDetails.email
      shopDetails.gstNumber = gstNumber || shopDetails.gstNumber
      shopDetails.licenseNumber = licenseNumber || shopDetails.licenseNumber
      shopDetails.location = location || shopDetails.location
      shopDetails.auditorName = auditorName || shopDetails.auditorName
      
      await shopDetails.save()
    } else {
      // Create new shop details
      shopDetails = new ShopDetails({
        shopName,
        address,
        phone,
        email,
        gstNumber,
        licenseNumber,
        location,
        auditorName
      })
      await shopDetails.save()
    }

    res.json({
      success: true,
      message: 'Shop details updated successfully',
      data: shopDetails
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Delete shop details (soft delete by setting isActive to false)
exports.deleteShopDetails = async (req, res) => {
  try {
    const shopDetails = await ShopDetails.findOne({ isActive: true })
    
    if (!shopDetails) {
      return res.status(404).json({
        success: false,
        message: 'Shop details not found'
      })
    }

    shopDetails.isActive = false
    await shopDetails.save()

    res.json({
      success: true,
      message: 'Shop details deleted successfully'
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}