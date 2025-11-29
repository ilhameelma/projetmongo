// server.js
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5002;

// Middleware
app.use(cors());
app.use(express.json());

// ✅ CORRECTION: Servir UNIQUEMENT le dossier courant
app.use(express.static(__dirname));

// Routes HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'indexmap.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../indexadmin.html'));
});

app.get('/city-detail', (req, res) => {
    res.sendFile(path.join(__dirname, 'city-detail.html'));
});

app.get('/statistics', (req, res) => {
    res.sendFile(path.join(__dirname, 'test.html'));
});

// MongoDB configuration
const MONGODB_URI = 'mongodb://localhost:27017/air_quality_db';
let db;

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

// Routes API avec meilleure gestion d'erreurs
app.get('/api/cities', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ error: "Base de données non connectée" });
        }

        const citiesData = await db.collection('city_hour')
            .aggregate([
                {
                    $group: {
                        _id: "$City",
                        aqi: { $avg: "$AQI" },
                        lastUpdate: { $max: "$Datetime" },
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
        
        res.json(citiesData || []);
    } catch (error) {
        console.error('Erreur API cities:', error);
        res.status(500).json({ error: error.message });
    }
});

// Détails d'une ville spécifique avec vérifications
app.get('/api/city/:cityName', async (req, res) => {
    try {
        const { cityName } = req.params;
        
        if (!db) {
            return res.status(500).json({ error: "Base de données non connectée" });
        }

        // Récupérer les données récentes de la ville
        const cityData = await db.collection('city_hour')
            .find({ City: cityName })
            .sort({ Datetime: -1 })
            .limit(100)
            .toArray();

        // Récupérer les stations de cette ville
        const stations = await db.collection('stations')
            .find({ City: cityName })
            .toArray();

        // Calculer les statistiques de base
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
                        minAQI: { $min: "$AQI" },
                        totalRecords: { $sum: 1 }
                    }
                }
            ]).toArray();

        const result = {
            city: cityName,
            data: cityData || [],
            stations: stations || [],
            stats: stats[0] || {
                avgAQI: 0,
                avgPM25: 0,
                avgPM10: 0,
                maxAQI: 0,
                minAQI: 0,
                totalRecords: 0
            }
        };

        console.log(`Données chargées pour ${cityName}:`, {
            records: result.data.length,
            stations: result.stations.length,
            stats: result.stats
        });

        res.json(result);
    } catch (error) {
        console.error('Erreur API city:', error);
        res.status(500).json({ error: error.message });
    }
});

// Statistiques détaillées avec gestion d'erreurs améliorée
app.get('/api/city-stats/:cityName', async (req, res) => {
    try {
        const { cityName } = req.params;
        const { period = 'month' } = req.query;

        if (!db) {
            return res.status(500).json({ error: "Base de données non connectée" });
        }

        let groupByFormat = "%Y-%m";
        
        switch(period) {
            case 'day':
                groupByFormat = "%Y-%m-%d";
                break;
            case 'week':
                groupByFormat = "%Y-%U";
                break;
            case 'month':
            default:
                groupByFormat = "%Y-%m";
                break;
        }

        // Vérifier si la ville existe
        const cityExists = await db.collection('city_hour').findOne({ City: cityName });
        if (!cityExists) {
            return res.status(404).json({ error: `Ville '${cityName}' non trouvée` });
        }

        // Données pour les graphiques d'évolution
        const evolutionData = await db.collection('city_hour')
            .aggregate([
                { $match: { City: cityName } },
                {
                    $group: {
                        _id: { 
                            $dateToString: { 
                                format: groupByFormat, 
                                date: { $toDate: "$Datetime" } 
                            } 
                        },
                        avgAQI: { $avg: "$AQI" },
                        avgPM25: { $avg: "$PM2.5" },
                        avgPM10: { $avg: "$PM10" },
                        recordCount: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } },
                { $match: { recordCount: { $gt: 0 } } }
            ]).toArray();

        // Statistiques générales
        const generalStats = await db.collection('city_hour')
            .aggregate([
                { $match: { City: cityName } },
                {
                    $group: {
                        _id: null,
                        avgAQI: { $avg: "$AQI" },
                        avgPM25: { $avg: "$PM2.5" },
                        avgPM10: { $avg: "$PM10" },
                        maxAQI: { $max: "$AQI" },
                        minAQI: { $min: "$AQI" },
                        totalReadings: { $sum: 1 }
                    }
                }
            ]).toArray();

        const response = {
            evolution: evolutionData || [],
            stats: generalStats[0] || {
                avgAQI: 0,
                avgPM25: 0,
                avgPM10: 0,
                maxAQI: 0,
                minAQI: 0,
                totalReadings: 0
            },
            period: period,
            city: cityName
        };

        console.log(`Stats chargées pour ${cityName} (${period}):`, {
            evolutionPoints: response.evolution.length,
            stats: response.stats
        });

        res.json(response);
    } catch (error) {
        console.error('Erreur API city-stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Données pour comparaison entre villes
app.get('/api/cities-comparison', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ error: "Base de données non connectée" });
        }

        const comparisonData = await db.collection('city_hour')
            .aggregate([
                {
                    $group: {
                        _id: "$City",
                        avgAQI: { $avg: "$AQI" },
                        avgPM25: { $avg: "$PM2.5" },
                        stationCount: { $addToSet: "$StationId" }
                    }
                },
                {
                    $project: {
                        city: "$_id",
                        aqi: { $round: ["$avgAQI", 0] },
                        pm25: { $round: ["$avgPM25", 1] },
                        stations: { $size: "$stationCount" },
                        _id: 0
                    }
                },
                { $sort: { aqi: -1 } },
                { $limit: 10 }
            ]).toArray();

        res.json(comparisonData || []);
    } catch (error) {
        console.error('Erreur API cities-comparison:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route de santé pour vérifier la connexion
app.get('/api/health', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ status: 'error', message: 'DB not connected' });
        }
        
        // Tester la connexion
        await db.command({ ping: 1 });
        
        // Compter les documents
        const cityCount = await db.collection('city_hour').countDocuments();
        const stationCount = await db.collection('stations').countDocuments();
        
        res.json({
            status: 'healthy',
            database: 'connected',
            collections: {
                city_hour: cityCount,
                stations: stationCount
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Démarrer le serveur
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
        console.log(`📁 Fichiers statiques servis depuis: ${__dirname}`);
    });
});