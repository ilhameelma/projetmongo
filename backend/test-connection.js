const mongoose = require('mongoose');
require('dotenv').config();

const testConnection = async () => {
    try {
        console.log('🔄 Test de connexion à MongoDB...');
        console.log('URI:', process.env.MONGODB_URI);
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Connecté avec succès à MongoDB via mongos');
        
        // Test des collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('📊 Collections disponibles:');
        collections.forEach(col => console.log('  -', col.name));
        
        // Test d'une requête simple
        const stationCount = await mongoose.connection.db.collection('stations').countDocuments();
        console.log(`📈 Nombre de stations: ${stationCount}`);
        
        await mongoose.connection.close();
        console.log('✅ Test terminé avec succès');
        
    } catch (error) {
        console.error('❌ Erreur de connexion:', error.message);
        process.exit(1);
    }
};


testConnection();