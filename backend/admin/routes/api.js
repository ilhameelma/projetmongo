const express = require('express');
const router = express.Router();
const database = require('../config/database');

// Get collection stats
router.get('/stats', async (req, res) => {
    try {
        const collections = ['stations', 'air_quality', 'city_hour', 'station_hour'];
        const stats = {};

        for (const collectionName of collections) {
            const collection = database.getCollection(collectionName);
            stats[collectionName] = await collection.countDocuments();
        }

        res.json({
            success: true,
            data: stats,
            message: 'Collection statistics retrieved successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving statistics',
            error: error.message
        });
    }
});

// CRUD Operations for Stations
router.get('/stations', async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const skip = (page - 1) * parseInt(limit);
        
        const collection = database.getCollection('stations');
        let query = {};
        
        if (search) {
            query = {
                $or: [
                    { StationId: { $regex: search, $options: 'i' } },
                    { City: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const stations = await collection.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        const total = await collection.countDocuments(query);

        res.json({
            success: true,
            data: stations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching stations',
            error: error.message
        });
    }
});

router.post('/stations', async (req, res) => {
    try {
        const collection = database.getCollection('stations');
        const result = await collection.insertOne(req.body);
        
        res.json({
            success: true,
            data: result,
            message: 'Station created successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating station',
            error: error.message
        });
    }
});

router.put('/stations/:id', async (req, res) => {
    try {
        const collection = database.getCollection('stations');
        const result = await collection.updateOne(
            { StationId: req.params.id },
            { $set: req.body }
        );
        
        res.json({
            success: true,
            data: result,
            message: 'Station updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating station',
            error: error.message
        });
    }
});

router.delete('/stations/:id', async (req, res) => {
    try {
        const collection = database.getCollection('stations');
        const result = await collection.deleteOne({ StationId: req.params.id });
        
        res.json({
            success: true,
            data: result,
            message: 'Station deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting station',
            error: error.message
        });
    }
});

// CRUD Operations for Air Quality
router.get('/air-quality', async (req, res) => {
    try {
        const { page = 1, limit = 10, city, date } = req.query;
        const skip = (page - 1) * parseInt(limit);
        
        const collection = database.getCollection('air_quality');
        let query = {};
        
        if (city) query.City = city;
        if (date) query.Date = date;

        const data = await collection.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        const total = await collection.countDocuments(query);

        res.json({
            success: true,
            data: data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching air quality data',
            error: error.message
        });
    }
});

// Performance testing endpoints
router.get('/performance/city-data', async (req, res) => {
    try {
        const { city } = req.query;
        const startTime = Date.now();
        
        const collection = database.getCollection('city_hour');
        const data = await collection.find({ City: city })
            .limit(1000)
            .toArray();
        
        const endTime = Date.now();
        const executionTime = endTime - startTime;

        res.json({
            success: true,
            data: {
                executionTime: `${executionTime}ms`,
                documentsReturned: data.length,
                sampleData: data.slice(0, 5)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error in performance test',
            error: error.message
        });
    }
});

router.get('/performance/station-data', async (req, res) => {
    try {
        const { stationId } = req.query;
        const startTime = Date.now();
        
        const collection = database.getCollection('station_hour');
        const data = await collection.find({ StationId: stationId })
            .limit(1000)
            .toArray();
        
        const endTime = Date.now();
        const executionTime = endTime - startTime;

        res.json({
            success: true,
            data: {
                executionTime: `${executionTime}ms`,
                documentsReturned: data.length,
                sampleData: data.slice(0, 5)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error in performance test',
            error: error.message
        });
    }
});

// Get unique cities and stations for filters
router.get('/filters/cities', async (req, res) => {
    try {
        const collection = database.getCollection('air_quality');
        const cities = await collection.distinct('City');
        
        res.json({
            success: true,
            data: cities
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching cities',
            error: error.message
        });
    }
});

router.get('/filters/stations', async (req, res) => {
    try {
        const collection = database.getCollection('stations');
        const stations = await collection.distinct('StationId');
        
        res.json({
            success: true,
            data: stations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching stations',
            error: error.message
        });
    }
});

module.exports = router;