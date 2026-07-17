const express = require('express');
const router = express.Router();

// FIXED: Changed the import path from '../middleware/authMiddleware' to '../middleware/auth'
const authMiddleware = require('../middleware/auth'); 
const { getQuotations, saveQuotation, downloadQuotationPdf } = require('../controllers/quotationController');

// Apply the auth middleware to protect the get and save routes
router.get('/', authMiddleware, getQuotations);
router.post('/', authMiddleware, saveQuotation);

// Keep the download route public so you can download the PDF easily
router.get('/:id/download', downloadQuotationPdf); 

module.exports = router;