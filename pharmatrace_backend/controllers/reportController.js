const pool = require('../config/db');

const submitReport = async (req, res) => {
  try {
    const { batch_id, reason } = req.body;
    const flagged_by = req.user.id; // Extracted from the JWT by authMiddleware

    // multer-s3 automatically uploads to Neon and attaches the URL to req.file.location
    const image_url = req.file ? req.file.location : null;

    if (!batch_id || !reason) {
      return res.status(400).json({ error: 'Batch ID and reason are required' });
    }

    // Insert the report into the database
    const newReport = await pool.query(
      `INSERT INTO flag_reports (batch_id, flagged_by, reason, image_url) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, batch_id, reason, image_url, reported_at`,
      [batch_id, flagged_by, reason, image_url]
    );

    res.status(201).json({
      message: 'Report submitted successfully',
      report: newReport.rows[0]
    });
  } catch (error) {
    console.error('Error submitting report:', error.message);
    res.status(500).json({ error: 'Server error during report submission' });
  }
};

const getReports = async (req, res) => {
  try {
    // Only fetch reports submitted by the logged-in pharmacist
    const reports = await pool.query(
      'SELECT * FROM flag_reports WHERE flagged_by = $1 ORDER BY reported_at DESC',
      [req.user.id]
    );
    
    res.status(200).json(reports.rows);
  } catch (error) {
    console.error('Error fetching reports:', error.message);
    res.status(500).json({ error: 'Server error while fetching reports' });
  }
};

module.exports = { submitReport, getReports };
