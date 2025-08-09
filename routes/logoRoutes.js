const express = require('express');
const multer = require('multer');
const Logo = require('../models/Logo');
const { protect: authMiddleware } = require('../middleware/authMiddleware');
const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Admin middleware
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Upload logo (Admin only)
router.post('/upload', authMiddleware, adminMiddleware, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Delete existing active logo first
    await Logo.deleteMany({ isActive: true });

    // Create new logo
    const newLogo = new Logo({
      filename: req.file.originalname,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer,
      isActive: true,
      uploadedBy: req.user.id
    });

    await newLogo.save();

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      logoId: newLogo._id
    });

  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Get active logo
router.get('/current', async (req, res) => {
  try {
    const logo = await Logo.findOne({ isActive: true });
    
    if (!logo) {
      return res.status(404).json({ message: 'No active logo found' });
    }

    res.set({
      'Content-Type': logo.mimeType,
      'Content-Length': logo.size,
      'Cache-Control': 'public, max-age=86400' // Cache for 1 day
    });

    res.send(logo.data);

  } catch (error) {
    console.error('Get logo error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get logo info (without data)
router.get('/info', async (req, res) => {
  try {
    const logo = await Logo.findOne({ isActive: true }).select('-data');
    
    if (!logo) {
      return res.json({ hasLogo: false });
    }

    res.json({
      hasLogo: true,
      filename: logo.filename,
      size: logo.size,
      uploadedAt: logo.uploadedAt
    });

  } catch (error) {
    console.error('Get logo info error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete logo (Admin only)
router.delete('/delete', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await Logo.deleteMany({ isActive: true });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No active logo found to delete' });
    }

    res.json({
      success: true,
      message: 'Logo deleted successfully'
    });

  } catch (error) {
    console.error('Delete logo error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;