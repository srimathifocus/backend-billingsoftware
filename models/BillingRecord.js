const mongoose = require('mongoose')
const billingRecordSchema = new mongoose.Schema({
  customer: Object,
  items: Array,
  loan: Object
}, { timestamps: true })
module.exports = mongoose.model('BillingRecord', billingRecordSchema)
