const pool = require('../config/db');
const { generatePresignedUrl } = require('../config/storage');

const submitReport = async (req, res) => {
  try {
    const { batch_id, reason, location } = req.body;
    const flagged_by = req.user.id;

    // multer-s3 uploads the image and provides its storage key.
    const image_key = req.file ? req.file.key : null;

    if (!batch_id || !reason || !location) {
      return res.status(400).json({
        error: 'Batch ID, reason, and location are required',
      });
    }

    const newReport = await pool.query(
      `INSERT INTO flag_reports
        (batch_id, flagged_by, reason, location, image_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, batch_id, reason, location, image_key, reported_at`,
      [batch_id, flagged_by, reason, location, image_key],
    );

    const report = newReport.rows[0];

    res.status(201).json({
      message: 'Report submitted successfully',
      report: {
        ...report,
        image_url: image_key ? await generatePresignedUrl(image_key) : null,,
      },
    });
  } catch (error) {
    console.error('Error submitting report:', error.message);

    res.status(500).json({
      error: 'Server error during report submission',
    });
  }
};

const getReports = async (req, res) => {
  try {
    // Only retrieve reports submitted by the authenticated user.
    const reports = await pool.query(
      `SELECT *
       FROM flag_reports
       WHERE flagged_by = $1
       ORDER BY reported_at DESC`,
      [req.user.id],
    );

    res.status(200).json(reportsWithUrls);
  } catch (error) {
    console.error('Error fetching reports:', error.message);

    res.status(500).json({
      error: 'Server error while fetching reports',
    });
  }
};

module.exports = {
  submitReport,
  getReports,
};
