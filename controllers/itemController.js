const Item = require('../models/Item')

// Add master item (for admin)
exports.addItem = async (req, res) => {
  try {
    const { code, name, categories, carats } = req.body
    
    // Validate required fields
    if (!code || !name || !categories || !carats) {
      return res.status(400).json({ 
        message: 'Code, name, categories, and carats are required' 
      })
    }

    // Ensure categories and carats are arrays
    const categoriesArray = Array.isArray(categories) ? categories : [categories]
    const caratsArray = Array.isArray(carats) ? carats : [carats]

    const item = new Item({ 
      code, 
      name, 
      categories: categoriesArray, 
      carats: caratsArray,
      itemType: 'master'
    })
    
    await item.save()
    res.status(201).json(item)
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Item code already exists' })
    }
    res.status(500).json({ message: error.message })
  }
}

// Add billing item (for billing process)
exports.addBillingItem = async (req, res) => {
  try {
    const { code, name, category, carat, weight, estimatedValue, loanId } = req.body
    
    const item = new Item({ 
      code, 
      name, 
      category, 
      carat, 
      weight, 
      estimatedValue, 
      loanId,
      itemType: 'billing'
    })
    
    await item.save()
    res.status(201).json(item)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.getAllItems = async (req, res) => {
  try {
    const { type } = req.query
    const filter = type ? { itemType: type } : {}
    const items = await Item.find(filter).sort({ createdAt: -1 })
    res.status(200).json(items)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get master items only (for billing dropdown)
exports.getMasterItems = async (req, res) => {
  try {
    const items = await Item.find({ itemType: 'master' }).sort({ createdAt: -1 })
    res.status(200).json(items)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body
    
    // Handle categories and carats arrays for master items
    if (updateData.categories && !Array.isArray(updateData.categories)) {
      updateData.categories = [updateData.categories]
    }
    if (updateData.carats && !Array.isArray(updateData.carats)) {
      updateData.carats = [updateData.carats]
    }
    
    const item = await Item.findByIdAndUpdate(id, updateData, { new: true })
    if (!item) return res.status(404).json({ message: 'Item not found' })
    res.status(200).json(item)
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Item code already exists' })
    }
    res.status(500).json({ message: error.message })
  }
}

exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params
    const item = await Item.findByIdAndDelete(id)
    if (!item) return res.status(404).json({ message: 'Item not found' })
    res.status(200).json({ message: 'Item deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
