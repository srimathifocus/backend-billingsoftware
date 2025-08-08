const Transaction = require("../models/transactionsModel");
const Loan = require("../models/Loan");
const Customer = require("../models/Customer");

exports.getTransactions = async (req, res) => {
  try {
    const { type, mode, startDate, endDate } = req.query;
    console.log("🔍 Transaction filter request:", { type, mode, startDate, endDate });
    
    const filter = {};
    
    if (type) filter.type = type;
    if (mode) filter.mode = mode;
    if (startDate && endDate) {
      // Create proper date range - use local timezone
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Set to start and end of day in local timezone
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      console.log("📅 Date filter range:");
      console.log("  Input startDate:", startDate);
      console.log("  Input endDate:", endDate);
      console.log("  Start:", start.toISOString(), "Local:", start.toLocaleString());
      console.log("  End:", end.toISOString(), "Local:", end.toLocaleString());
      
      filter.date = {
        $gte: start,
        $lte: end,
      };
    } else if (startDate) {
      // Only start date provided
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      console.log("📅 Start date filter:", start.toISOString(), "Local:", start.toLocaleString());
      filter.date = { $gte: start };
    } else if (endDate) {
      // Only end date provided
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      console.log("📅 End date filter:", end.toISOString(), "Local:", end.toLocaleString());
      filter.date = { $lte: end };
    }
    
    console.log("📊 Final filter object:", filter);
    
    const transactions = await Transaction.find(filter)
      .populate({
        path: 'loanId',
        select: 'loanId customerId amount',
        populate: {
          path: 'customerId',
          select: 'name phone'
        }
      })
      .sort({ date: -1 });
    
    console.log("✅ Found transactions:", transactions.length);
    console.log("📋 Sample transaction dates:", transactions.slice(0, 5).map(t => ({ 
      id: t._id, 
      date: t.date, 
      dateString: t.date.toISOString(),
      localDate: t.date.toLocaleDateString(),
      type: t.type, 
      mode: t.mode 
    })));
    
    // Show all transaction dates for debugging
    console.log("📊 All recent transaction dates in DB:");
    const allTransactions = await Transaction.find({}).select('date type').sort({ date: -1 }).limit(10);
    allTransactions.forEach(t => {
      const dateStr = t.date.toISOString().split('T')[0]; // YYYY-MM-DD format
      console.log(`  ${t.date.toISOString()} (${dateStr}) - ${t.type}`);
    });
    
    // If we have a date filter but no results, try a different approach
    if (filter.date && transactions.length === 0 && allTransactions.length > 0) {
      console.log("🔄 No results with date filter, trying alternative approach...");
      
      // Try using $expr with date string comparison
      if (startDate && endDate) {
        const altFilter = { ...filter };
        delete altFilter.date;
        
        // Add date string comparison
        altFilter.$expr = {
          $and: [
            { $gte: [{ $dateToString: { format: "%Y-%m-%d", date: "$date" } }, startDate] },
            { $lte: [{ $dateToString: { format: "%Y-%m-%d", date: "$date" } }, endDate] }
          ]
        };
        
        console.log("🔄 Trying alternative filter:", JSON.stringify(altFilter, null, 2));
        
        const altTransactions = await Transaction.find(altFilter)
          .populate({
            path: 'loanId',
            select: 'loanId customerId amount',
            populate: {
              path: 'customerId',
              select: 'name phone'
            }
          })
          .sort({ date: -1 });
        
        console.log("✅ Alternative approach found:", altTransactions.length, "transactions");
        
        if (altTransactions.length > 0) {
          return res.status(200).json(altTransactions);
        }
      }
    }
    
    res.status(200).json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTransactionSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchStage = {};
    if (startDate && endDate) {
      // Create proper date range - start of startDate to end of endDate
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Start of day
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day
      
      matchStage.date = {
        $gte: start,
        $lte: end,
      };
    } else if (startDate) {
      // Only start date provided
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      matchStage.date = { $gte: start };
    } else if (endDate) {
      // Only end date provided
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchStage.date = { $lte: end };
    }
    
    const summary = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            type: '$type',
            mode: '$mode'
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          modes: {
            $push: {
              mode: '$_id.mode',
              amount: '$totalAmount',
              count: '$count'
            }
          },
          totalAmount: { $sum: '$totalAmount' },
          totalCount: { $sum: '$count' }
        }
      }
    ]);
    
    // Format the response to match frontend expectations
    const formattedSummary = {
      billing: {
        total: 0,
        count: 0,
        breakdown: {
          cash: { amount: 0, count: 0 },
          online: { amount: 0, count: 0 }
        }
      },
      repayment: {
        total: 0,
        count: 0,
        breakdown: {
          cash: { amount: 0, count: 0 },
          online: { amount: 0, count: 0 }
        }
      }
    };
    
    summary.forEach(item => {
      const type = item._id;
      if (type === 'billing' || type === 'repayment') {
        formattedSummary[type].total = item.totalAmount;
        formattedSummary[type].count = item.totalCount;
        
        item.modes.forEach(mode => {
          if (mode.mode === 'cash' || mode.mode === 'online') {
            formattedSummary[type].breakdown[mode.mode] = {
              amount: mode.amount,
              count: mode.count
            };
          }
        });
      }
    });
    
    res.status(200).json(formattedSummary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOverallStatistics = async (req, res) => {
  try {
    // Get overall transaction statistics
    const totalStats = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 }
        }
      }
    ]);
    
    // Get breakdown by type and mode
    const typeBreakdown = await Transaction.aggregate([
      {
        $group: {
          _id: {
            type: '$type',
            mode: '$mode'
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get loan statistics
    const loanStats = await Loan.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalCash: { $sum: '$payment.cash' },
          totalOnline: { $sum: '$payment.online' }
        }
      }
    ]);
    
    // Get item statistics
    const Item = require('../models/Item');
    const totalItems = await Item.countDocuments();
    const pledgedItems = await Item.countDocuments({ status: 'pledged' });
    const availableItems = await Item.countDocuments({ status: 'available' });
    
    res.status(200).json({
      totalTransactions: totalStats[0] || { totalAmount: 0, totalCount: 0 },
      typeBreakdown,
      loanStats,
      totalItems,
      pledgedItems,
      availableItems
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};