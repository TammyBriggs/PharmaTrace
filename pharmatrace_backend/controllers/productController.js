const pool = require('../config/db');
const CATEGORIES = ['Antimalarial', 'Antibiotic', 'ARV'];

const toApi = (r) => ({
  id: r.id, registrationNumber: r.registration_number, brandName: r.brand_name, genericName: r.generic_name,
  strength: r.strength, dosageForm: r.dosage_form, packSize: r.pack_size, shelfLifeMonths: r.shelf_life_months,
  category: r.category, manufacturerName: r.manufacturer_name, country: r.country,
});

// GET /api/products?q=&category=&manufacturer=&limit=   (feeds the Submit-batch product picker)
const listProducts = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const like = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null;
    const category = CATEGORIES.includes(req.query.category) ? req.query.category : null;
    const maker = String(req.query.manufacturer || '').trim().slice(0, 150) || null;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const { rows } = await pool.query(
      `SELECT * FROM products
        WHERE ($1::text IS NULL OR brand_name ILIKE $1 OR generic_name ILIKE $1 OR registration_number ILIKE $1)
          AND ($2::text IS NULL OR category = $2)
          AND ($3::text IS NULL OR manufacturer_name = $3)
        ORDER BY brand_name LIMIT $4`, [like, category, maker, limit]);
    res.status(200).json({ items: rows.map(toApi) });
  } catch (e) {
    console.error('Error listing products:', e.message);
    res.status(500).json({ error: 'Server error while loading products' });
  }
};
module.exports = { listProducts, toApi };
