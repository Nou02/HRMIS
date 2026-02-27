const express = require('express');

module.exports = () => {
  const router = express.Router();
  router.get('/', (_req, res) => {
    res.json({ ok: true });
  });
  return router;
};
