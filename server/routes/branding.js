const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Identidade visual pública (usada na tela de login, rastreamento e impressão)
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM config').all();
    const config = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const owner = db
      .prepare(
        `SELECT company_name, company_cnpj, email, phone, whatsapp_number, address, logo_path
         FROM users ORDER BY id ASC LIMIT 1`
      )
      .get();

    res.json({
      app_name: config.app_name || 'Assistência Técnica TI',
      company_name: owner?.company_name || config.app_name || 'Assistência Técnica TI',
      company_cnpj: owner?.company_cnpj || '',
      email: owner?.email || '',
      phone: owner?.phone || '',
      address: owner?.address || '',
      logo: config.company_logo || owner?.logo_path || '',
      whatsapp: config.whatsapp_number || owner?.whatsapp_number || owner?.phone || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
