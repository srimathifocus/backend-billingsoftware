const mongoose = require('mongoose')

const savedItemSchema = new mongoose.Schema({
  name: String,
  type: String,
  itemCode: String,
  karat: String,
  weight: Number,
  description: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true })

module.exports = mongoose.model('SavedItem', savedItemSchema)
