// server.js
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Dossier pour vos fichiers HTML

// Configuration MongoDB
const MONGODB_URI = 'mongodb://localhost:27017/air_quality_db';
let db;

// Connexion MongoDB
async function connectDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db('air_quality_db');
        console.log('Connecté à MongoDB');
    } catch (error) {
        console.error('Erreur connexion MongoDB:', error);
    }
}

// Routes API

// Données pour la carte principale
app.get('/api/cities', async (req, res) => {
    try {
        const citiesData = await db.collection('air_quality')
            .aggregate([
                {
                    $group: {
                        _id: "$City",
                        aqi: { $avg: "$AQI" },
                        lastUpdate: { $max: "$Date" },
                        stationCount: { $addToSet: "$StationId" }
                    }
                },
                {
                    $project: {
                        city: "$_id",
                        aqi: { $round: ["$aqi", 0] },
                        lastUpdate: 1,
                        stationCount: { $size: "$stationCount" },
                        _id: 0
                    }
                }
            ]).toArray();
        
        res.json(citiesData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Détails d'une ville spécifique
app.get('/api/city/:cityName', async (req, res) => {
    try {
        const { cityName } = req.params;
        
        const cityData = await db.collection('city_hour')
            .find({ City: cityName })
            .sort({ Datetime: -1 })
            .limit(1000)
            .toArray();

        const stations = await db.collection('stations')
            .find({ City: cityName })
            .toArray();

        res.json({
            city: cityName,
            data: cityData,
            stations: stations
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Données pour les graphiques
app.get('/api/city-stats/:cityName', async (req, res) => {
    try {
        const { cityName } = req.params;
        const { period = 'month' } = req.query;

        const stats = await db.collection('city_hour')
            .aggregate([
                { $match: { City: cityName } },
                {
                    $group: {
                        _id: null,
                        avgAQI: { $avg: "$AQI" },
                        avgPM25: { $avg: "$PM2.5" },
                        avgPM10: { $avg: "$PM10" },
                        maxAQI: { $max: "$AQI" },
                        minAQI: { $min: "$AQI" }
                    }
                }
            ]).toArray();

        res.json(stats[0] || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Servir les fichiers HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'indexmap.html'));
});

app.get('/city-details', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'city-details.html'));
});

// Démarrer le serveur
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Serveur démarré sur http://localhost:${PORT}`);
    });
});