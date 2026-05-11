// src/routes/ingest.routes.js

const express = require('express');
const router = express.Router();
const { ingestDocument, ingestUrl, ingestUrls } = require('../services/ingest');

router.post('/', async (req, res) => {
    const {
        text,
        url,
        title,
        subject,
        gradeLevel,
        sourceName,
        resourceType = 'other',
    } = req.body;

    if (!text && !url) {
        return res.status(400).json({ ok: false, error: "text o url requerido" });
    }

    try {
        const result = text
            ? await ingestDocument({
                url,
                title,
                content: text,
                resourceType,
                subject,
                gradeLevel,
                sourceName,
            })
            : await ingestUrl(url);

        res.json({ 
            ok: true, 
            message: "Recurso guardado correctamente.",
            ...result
        });

    } catch (error) {
        console.error('Error final en ingestión:', error.message);
        res.status(500).json({ 
            ok: false, 
            error: 'Error al procesar y guardar en BD: ' + error.message 
        });
    }
});

router.post('/batch', async (req, res) => {
    const { urls } = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ ok: false, error: "urls debe ser una lista" });
    }

    const results = await ingestUrls(urls);
    res.json({ ok: true, results });
});

module.exports = router;
