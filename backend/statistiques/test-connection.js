const mongoose = require('mongoose');
require('dotenv').config();

const testConnection = async () => {
    try {
        console.log('🔄 Test de connexion à MongoDB...');
        
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/air_quality_db';
        console.log('📡 URI:', MONGODB_URI);
        
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
        });
        
        console.log('✅ Connecté avec succès à MongoDB');
        
        // Vérifier la base de données
        const dbName = mongoose.connection.db.databaseName;
        console.log(`📁 Base de données: ${dbName}`);
        
        // Collections disponibles
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('\n📊 Collections disponibles:');
        collections.forEach(col => console.log('  -', col.name));
        
        // Test des données
        console.log('\n🔍 Test des données:');
        
        // Stations
        try {
            const Station = mongoose.connection.db.collection('stations');
            const stationCount = await Station.countDocuments();
            console.log(`📍 Nombre de stations: ${stationCount}`);
            
            const sampleStation = await Station.findOne();
            if (sampleStation) {
                console.log(`   Exemple: ${sampleStation.StationId} - ${sampleStation.City} - ${sampleStation.Status}`);
            }
        } catch (err) {
            console.log('❌ Erreur collection stations:', err.message);
        }
        
        // Air Quality
        try {
            const AirQuality = mongoose.connection.db.collection('air_quality');
            const airQualityCount = await AirQuality.countDocuments();
            console.log(`🌫️  Nombre de données air_quality: ${airQualityCount}`);
            
            const sampleAQ = await AirQuality.findOne();
            if (sampleAQ) {
                console.log(`   Exemple: ${sampleAQ.City} - PM2.5: ${sampleAQ.PM2_5} - AQI: ${sampleAQ.AQI}`);
            }
        } catch (err) {
            console.log('❌ Erreur collection air_quality:', err.message);
        }
        
        // City Hour
        try {
            const CityHour = mongoose.connection.db.collection('city_hour');
            const cityHourCount = await CityHour.countDocuments();
            console.log(`🏙️  Nombre de données city_hour: ${cityHourCount}`);
        } catch (err) {
            console.log('❌ Erreur collection city_hour:', err.message);
        }
        
        // Station Hour
        try {
            const StationHour = mongoose.connection.db.collection('station_hour');
            const stationHourCount = await StationHour.countDocuments();
            console.log(`⏱️  Nombre de données station_hour: ${stationHourCount}`);
        } catch (err) {
            console.log('❌ Erreur collection station_hour:', err.message);
        }
        
        // Test d'agrégation simple
        console.log('\n📈 Test d\'agrégation:');
        try {
            const AirQuality = mongoose.connection.db.collection('air_quality');
            const avgStats = await AirQuality.aggregate([
                { 
                    $match: { 
                        PM2_5: { $exists: true, $ne: null } 
                    } 
                },
                { 
                    $group: { 
                        _id: null, 
                        avgPM25: { $avg: "$PM2_5" },
                        count: { $sum: 1 }
                    } 
                }
            ]).toArray();
            
            if (avgStats.length > 0) {
                console.log(`   PM2.5 moyen: ${avgStats[0].avgPM25 ? avgStats[0].avgPM25.toFixed(2) : 'N/A'}`);
                console.log(`   Documents analysés: ${avgStats[0].count}`);
            }
        } catch (err) {
            console.log('❌ Erreur agrégation:', err.message);
        }
        
        await mongoose.connection.close();
        console.log('\n✅ Test terminé avec succès - Prêt pour le dashboard!');
        
    } catch (error) {
        console.error('❌ Erreur de connexion:', error.message);
        
        if (error.name === 'MongoServerSelectionError') {
            console.log('💡 Vérifiez que:');
            console.log('   - MongoDB est démarré');
            console.log('   - Le cluster shardé est accessible');
            console.log('   - L\'URI dans .env est correcte');
            console.log('   - Le port 27017 est accessible');
        }
        
        process.exit(1);
    }
};

testConnection();