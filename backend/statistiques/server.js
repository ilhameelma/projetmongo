const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static('C:/projetMongo/frontend'));

// Connexion MongoDB avec gestion du sharding
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connecté à MongoDB avec sharding');
    } catch (error) {
        console.error('❌ Erreur de connexion MongoDB:', error);
        process.exit(1);
    }
};

// Schémas MongoDB
const stationSchema = new mongoose.Schema({
    StationId: String,
    City: String,
    State: String,
    Latitude: Number,
    Longitude: Number,
    Elevation: Number,
    Status: String
});

const airQualitySchema = new mongoose.Schema({
    City: String,
    Date: String,
    PM2_5: Number,
    PM10: Number,
    NO2: Number,
    SO2: Number,
    CO: Number,
    O3: Number,
    AQI: Number,
    AQI_Bucket: String
});

const cityHourSchema = new mongoose.Schema({
    City: String,
    Datetime: String,
    PM2_5: Number,
    PM10: Number,
    NO2: Number,
    AQI: Number,
    AQI_Bucket: String
});

const stationHourSchema = new mongoose.Schema({
    StationId: String,
    Datetime: String,
    PM2_5: Number,
    PM10: Number,
    NO2: Number,
    AQI: Number,
    AQI_Bucket: String
});

// Modèles
const Station = mongoose.model('Station', stationSchema, 'stations');
const AirQuality = mongoose.model('AirQuality', airQualitySchema, 'air_quality');
const CityHour = mongoose.model('CityHour', cityHourSchema, 'city_hour');
const StationHour = mongoose.model('StationHour', stationHourSchema, 'station_hour');

// Routes API

// 1. Statistiques globales
app.get('/api/stats/global', async (req, res) => {
    try {
        const stats = await AirQuality.aggregate([
            {
                $group: {
                    _id: null,
                    avgPM25: { $avg: "$PM2_5" },
                    avgPM10: { $avg: "$PM10" },
                    avgAQI: { $avg: "$AQI" },
                    maxPM25: { $max: "$PM2_5" },
                    maxPM10: { $max: "$PM10" },
                    totalRecords: { $sum: 1 }
                }
            }
        ]);

        const stationCount = await Station.countDocuments({ Status: "Active" });
        
        res.json({
            pm25: stats[0]?.avgPM25 || 0,
            pm10: stats[0]?.avgPM10 || 0,
            aqi: stats[0]?.avgAQI || 0,
            activeStations: stationCount,
            totalRecords: stats[0]?.totalRecords || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Évolution temporelle
app.get('/api/stats/trends', async (req, res) => {
    try {
        const trends = await AirQuality.aggregate([
            {
                $group: {
                    _id: { $substr: ["$Date", 0, 4] }, // Extraire l'année
                    pm25: { $avg: "$PM2_5" },
                    pm10: { $avg: "$PM10" },
                    aqi: { $avg: "$AQI" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        res.json(trends);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Données par ville
app.get('/api/cities/:city', async (req, res) => {
    try {
        const { city } = req.params;
        const { year, season } = req.query;

        let matchStage = { City: city };
        
        if (year && year !== 'all') {
            matchStage.Date = { $regex: `^${year}` };
        }

        const cityData = await AirQuality.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$City",
                    avgPM25: { $avg: "$PM2_5" },
                    avgPM10: { $avg: "$PM10" },
                    avgAQI: { $avg: "$AQI" },
                    records: { $sum: 1 }
                }
            }
        ]);

        res.json(cityData[0] || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Top 10 des stations les plus polluées
app.get('/api/stations/top-polluted', async (req, res) => {
    try {
        const topStations = await StationHour.aggregate([
            {
                $group: {
                    _id: "$StationId",
                    avgPM25: { $avg: "$PM2_5" },
                    avgPM10: { $avg: "$PM10" },
                    avgAQI: { $avg: "$AQI" },
                    maxAQI: { $max: "$AQI" }
                }
            },
            { $sort: { avgPM25: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: "stations",
                    localField: "_id",
                    foreignField: "StationId",
                    as: "stationInfo"
                }
            },
            {
                $project: {
                    station: "$_id",
                    city: { $arrayElemAt: ["$stationInfo.City", 0] },
                    pm25: { $round: ["$avgPM25", 1] },
                    pm10: { $round: ["$avgPM10", 1] },
                    aqi: { $round: ["$avgAQI", 0] },
                    category: {
                        $switch: {
                            branches: [
                                { case: { $lte: ["$avgAQI", 50] }, then: "Good" },
                                { case: { $lte: ["$avgAQI", 100] }, then: "Moderate" },
                                { case: { $lte: ["$avgAQI", 150] }, then: "Poor" },
                                { case: { $lte: ["$avgAQI", 200] }, then: "Very Poor" },
                                { case: { $gt: ["$avgAQI", 200] }, then: "Severe" }
                            ],
                            default: "Unknown"
                        }
                    }
                }
            }
        ]);

        res.json(topStations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Distribution AQI
app.get('/api/stats/aqi-distribution', async (req, res) => {
    try {
        const distribution = await AirQuality.aggregate([
            {
                $group: {
                    _id: "$AQI_Bucket",
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json(distribution);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Données saisonnières
app.get('/api/stats/seasonal', async (req, res) => {
    try {
        const seasonalData = await AirQuality.aggregate([
            {
                $addFields: {
                    month: { $toInt: { $substr: ["$Date", 5, 2] } },
                    year: { $toInt: { $substr: ["$Date", 0, 4] } }
                }
            },
            {
                $bucket: {
                    groupBy: "$month",
                    boundaries: [1, 3, 6, 9, 12],
                    default: "Other",
                    output: {
                        pm25: { $avg: "$PM2_5" },
                        pm10: { $avg: "$PM10" },
                        aqi: { $avg: "$AQI" },
                        count: { $sum: 1 }
                    }
                }
            }
        ]);

        res.json(seasonalData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. Statut des stations
app.get('/api/stations/status', async (req, res) => {
    try {
        const status = await Station.aggregate([
            {
                $group: {
                    _id: "$Status",
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. Recherche et filtres
app.get('/api/search', async (req, res) => {
    try {
        const { city, year, season, pollutant } = req.query;
        
        let matchStage = {};
        
        if (city && city !== 'all') matchStage.City = city;
        if (year && year !== 'all') matchStage.Date = { $regex: `^${year}` };
        
        const results = await AirQuality.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$City",
                    pm25: { $avg: "$PM2_5" },
                    pm10: { $avg: "$PM10" },
                    no2: { $avg: "$NO2" },
                    aqi: { $avg: "$AQI" }
                }
            },
            { $sort: { aqi: -1 } }
        ]);

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route de santé
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        timestamp: new Date().toISOString()
    });
});

// Gestion des erreurs 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// Middleware de gestion d'erreurs
app.use((error, req, res, next) => {
    console.error('Erreur:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Démarrage du serveur
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Serveur backend démarré sur le port ${PORT}`);
        console.log(`📊 API disponible sur: http://localhost:${PORT}/api`);
    });
});
// 9. Stations par ville
app.get('/api/stations/by-city', async (req, res) => {
    try {
        const stationsByCity = await Station.aggregate([
            {
                $group: {
                    _id: "$City",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        res.json(stationsByCity);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
module.exports = app;