const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
require('dotenv').config();

// Configure the S3 client to point to Neon's Object Storage
const s3 = new S3Client({
  region: 'eu-central-1', // Matches your Frankfurt region
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY,
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY,
  },
  forcePathStyle: true, // Required for many S3-compatible storage providers
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.OBJECT_STORAGE_BUCKET,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      // Store files in a 'reports' folder with a unique timestamp
      cb(null, `reports/${Date.now().toString()}-${file.originalname}`);
    }
  })
});

module.exports = upload;
