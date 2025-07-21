const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
    },
    type: {
      type: String,
      enum: ["billing", "repayment"],
      required: true,
    },
    mode: {
      type: String,
      enum: ["cash", "online"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);