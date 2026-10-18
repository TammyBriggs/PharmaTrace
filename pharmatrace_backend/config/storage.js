const {
  S3Client,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multer = require('multer');
const multerS3 = require('multer-s3');

require('dotenv').config();

// Configure the S3 client to point to Neon's Object Storage.
const s3 = new S3Client({
  region: 'eu-central-1', // Frankfurt region
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY,
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY,
  },
  forcePathStyle: true,
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.OBJECT_STORAGE_BUCKET,

    metadata: (req, file, cb) => {
      cb(null, {
        fieldName: file.fieldname,
      });
    },

    key: (req, file, cb) => {
      const folder =
        file.fieldname === 'profile_pic' ? 'profiles' : 'reports';

      const safeFileName = file.originalname.replace(
        /[^a-zA-Z0-9._-]/g,
        '_',
      );

      cb(
        null,
        `${folder}/${Date.now()}-${safeFileName}`,
      );
    },
  }),
});

// Generate a temporary URL for securely accessing a private file.
// The URL expires after 15 minutes (900 seconds).
const generatePresignedUrl = async (key) => {
  if (!key) return null;

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.OBJECT_STORAGE_BUCKET,
      Key: key,
    });

    return await getSignedUrl(s3, command, {
      expiresIn: 900,
    });
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    return null;
  }
};

module.exports = {
  upload,
  generatePresignedUrl,
};