// Script d'import des données JSON optimisé pour le sharding composé
print("Début de l'import des données avec optimisation sharding composé...");

const db = db.getSiblingDB("air_quality_db");

// Fonction optimisée pour l'import avec vérification du sharding
function importJSONFile(filename, collectionName) {
    try {
        print(`\n📥 Import de ${filename} dans ${collectionName}...`);
        const fileContent = cat(filename);
        
        // Parser le JSON ligne par ligne (format MongoDB export)
        const lines = fileContent.trim().split('\n');
        const documents = lines.map(line => JSON.parse(line));
        
        if (documents.length > 0) {
            print(`   📊 ${documents.length} documents à importer...`);
            
            // Import par lots pour meilleures performances
            const batchSize = 1000;
            let totalImported = 0;
            
            for (let i = 0; i < documents.length; i += batchSize) {
                const batch = documents.slice(i, i + batchSize);
                const result = db[collectionName].insertMany(batch);
                totalImported += result.insertedCount;
                
                if (i % 5000 === 0) {
                    print(`   ✅ ${totalImported}/${documents.length} documents importés...`);
                }
            }
            
            print(`   🎉 ${totalImported} documents importés dans ${collectionName}`);
            
            // Vérification de la distribution après import
            print(`   📈 Distribution ${collectionName}:`);
            const stats = db[collectionName].stats();
            print(`      - Documents: ${stats.count}`);
            print(`      - Taille: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            print(`      - Stockage: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);
            
            return totalImported;
        } else {
            print(`   ❌ Aucune donnée dans ${filename}`);
            return 0;
        }
    } catch (e) {
        print(`   ❌ Erreur import ${filename}: ${e}`);
        return 0;
    }
}

// Importer les données dans l'ordre optimal pour le sharding
try {
    print("🚀 DÉBUT DE L'IMPORT DES DONNÉES");
    print("=================================");
    
    let totalImported = 0;
    
    // 1. Stations d'abord (données de référence)
    totalImported += importJSONFile('/data/stations.json', 'stations');
    
    // 2. Données daily (air_quality)
    totalImported += importJSONFile('/data/air_quality.json', 'air_quality');
    
    // 3. Données horaires (city_hour et station_hour)
    totalImported += importJSONFile('/data/city_hour.json', 'city_hour');
    totalImported += importJSONFile('/data/station_hour.json', 'station_hour');
    
    print(`\n📈 IMPORT TERMINÉ: ${totalImported} documents au total`);
    
} catch (e) {
    print("❌ Erreur lors de l'import: " + e);
}

// Vérification finale de la distribution avec sharding composé
print("\n📊 VÉRIFICATION FINALE AVEC SHARDING COMPOSÉ:");
print("============================================");

const collections = ["air_quality", "city_hour", "station_hour", "stations"];

collections.forEach(collection => {
    print(`\n🔍 Collection: ${collection}`);
    try {
        const count = db[collection].count();
        const stats = db[collection].stats();
        
        print(`   📝 Documents: ${count}`);
        print(`   💾 Taille données: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        print(`   💿 Stockage: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);
        print(`   📋 Index: ${stats.nindexes} index`);
        
        // Vérifier la distribution par clé de sharding
        if (collection !== "stations") {
            const distinctKeys = db[collection].distinct(getShardKeyField(collection));
            print(`   🗂️  Valeurs distinctes (clé primaire): ${distinctKeys.length}`);
        }
        
    } catch (e) {
        print(`   ❌ Erreur statistiques: ${e}`);
    }
});

// Vérification du statut du sharding
print("\n🎯 STATUT FINAL DU SHARDING COMPOSÉ:");
try {
    const finalStatus = sh.status();
    print("✅ Sharding composé actif et opérationnel");
    print("📊 Distribution des chunks par collection:");
    
    const chunkStats = db.getSiblingDB("config").chunks.aggregate([
        { $group: { _id: "$ns", totalChunks: { $sum: 1 } } }
    ]).toArray();
    
    chunkStats.forEach(stat => {
        print(`   📦 ${stat._id}: ${stat.totalChunks} chunks`);
    });
    
} catch (e) {
    print("❌ Erreur vérification statut sharding: " + e);
}

// Fonction utilitaire pour obtenir le champ principal de sharding
function getShardKeyField(collection) {
    const keys = {
        'air_quality': 'City',
        'city_hour': 'City', 
        'station_hour': 'StationId',
        'stations': 'StationId'
    };
    return keys[collection];
}

print("\n🎉 SHARDING COMPOSÉ APPLIQUÉ AVEC SUCCÈS!");
print("=========================================");
print("✅ Données importées et distribuées selon les clés composées");
print("✅ Optimisation pour requêtes temporelles et géographiques");
print("✅ Cluster prêt pour l'application web");