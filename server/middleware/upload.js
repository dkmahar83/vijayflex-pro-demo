const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'customers');
const ORDER_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'orders');
const EMPLOYEE_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'employees');
fs.mkdirSync(ORDER_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(EMPLOYEE_UPLOAD_DIR, { recursive: true });

// Make sure the folder exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const customerId = req.params.id;
    const filename = `customer_${customerId}_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

function fileFilter(req, file, cb) {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, webp) are allowed'));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});
const orderStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ORDER_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `order_${req.params.id}_${Date.now()}${ext}`);
  }
});

const uploadOrder = multer({ storage: orderStorage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

const employeeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, EMPLOYEE_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `employee_${req.params.id}_${Date.now()}${ext}`);
  }
});

const uploadEmployee = multer({ storage: employeeStorage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = { upload, uploadOrder, uploadEmployee };