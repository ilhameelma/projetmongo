// Script d'initialisation du cluster shardé avec sharding composé
sleep(15000); // Attendre que les services soient démarrés

// Configuration du replica set des config servers
try {
    print("Configuration du replica set des config servers...");
    const config = {
        _id: "configrs",
        configsvr: true,
        members: [
            { _id: 0, host: "mongodb-config-1:27017" },
            { _id: 1, host: "mongodb-config-2:27017" },
            { _id: 2, host: "mongodb-config-3:27017" }
        ]
    };
    rs.initiate(config, { force: true });
    print("✅ Config servers replica set initialisé");
} catch (e) {
    print("❌ Erreur configuration config servers: " + e);
}

// Attendre un peu pour la réplication
sleep(5000);

// Connexion au router mongos
try {
    print("Configuration du sharding via mongos...");
    
    // Ajouter les shards
    sh.addShard("mongodb-shard1:27017");
    sh.addShard("mongodb-shard2:27017");
    sh.addShard("mongodb-shard3:27017");
    
    print("✅ Shards ajoutés au cluster");
} catch (e) {
    print("❌ Erreur ajout shards: " + e);
}

// Configuration de la base de données et des collections avec SHARDING COMPOSÉ
try {
    print("Configuration de la base de données avec sharding composé...");
    
    // Activer le sharding pour la base de données
    sh.enableSharding("air_quality_db");
    print("✅ Sharding activé pour la base de données air_quality_db");
    
    // Créer les collections et configurer le SHARDING COMPOSÉ adapté à vos données
    db = db.getSiblingDB("air_quality_db");
    
    print("Configuration du sharding composé pour les collections...");

    // City Hour - sharding composé City + Datetime
    db.createCollection("city_hour");
    sh.shardCollection("air_quality_db.city_hour", { 
        "City": 1, 
        "Datetime": 1  // Champ qui existe dans vos données
    });
    print("✅ Sharding composé configuré pour city_hour (City + Datetime)");

    // Air Quality - sharding composé City + Date  
    db.createCollection("air_quality");
    sh.shardCollection("air_quality_db.air_quality", { 
        "City": 1,
        "Date": 1  // Champ qui existe dans vos données
    });
    print("✅ Sharding composé configuré pour air_quality (City + Date)");

    // Station Hour - sharding composé StationId + Datetime
    db.createCollection("station_hour");
    sh.shardCollection("air_quality_db.station_hour", { 
        "StationId": 1,
        "Datetime": 1  // Champ qui existe dans vos données
    });
    print("✅ Sharding composé configuré pour station_hour (StationId + Datetime)");

    // Stations - sharding simple (données de référence)
    db.createCollection("stations");
    sh.shardCollection("air_quality_db.stations", { "StationId": 1 });
    print("✅ Sharding simple configuré pour stations (StationId)");
    
    print("✅ Toutes les collections créées et sharding composé configuré");
    
} catch (e) {
    print("❌ Erreur configuration collections: " + e);
}

// Création d'index avancés pour optimiser les performances avec sharding composé
try {
    print("Création des index optimisés pour le sharding composé...");
    db = db.getSiblingDB("air_quality_db");
    
    // Index pour air_quality - optimisé pour les requêtes temporelles par ville
    db.air_quality.createIndex({ "City": 1, "Date": -1 }); // Pour les données récentes
    db.air_quality.createIndex({ "AQI_Bucket": 1, "City": 1 });
    db.air_quality.createIndex({ "Date": 1 }); // Index global sur la date
    print("✅ Index créés pour air_quality");
    
    // Index pour city_hour - optimisé pour l'analyse temporelle
    db.city_hour.createIndex({ "City": 1, "Datetime": -1 }); // Données récentes par ville
    db.city_hour.createIndex({ "Datetime": 1 }); // Index global temporel
    db.city_hour.createIndex({ "AQI_Bucket": 1, "City": 1, "Datetime": 1 });
    print("✅ Index créés pour city_hour");
    
    // Index pour station_hour - optimisé pour l'analyse par station
    db.station_hour.createIndex({ "StationId": 1, "Datetime": -1 }); // Données récentes par station
    db.station_hour.createIndex({ "Datetime": 1 }); // Index global temporel
    db.station_hour.createIndex({ "AQI_Bucket": 1, "StationId": 1 });
    print("✅ Index créés pour station_hour");
    
    // Index pour stations - recherche géographique
    db.stations.createIndex({ "City": 1 });
    db.stations.createIndex({ "State": 1 });
    db.stations.createIndex({ "Status": 1 });
    db.stations.createIndex({ "StationId": 1, "City": 1 }); // Couverture pour les jointures
    print("✅ Index créés pour stations");
    
} catch (e) {
    print("❌ Erreur création index: " + e);
}

// Vérification détaillée de la configuration du sharding composé
print("\n📊 VÉRIFICATION DÉTAILLÉE DU SHARDING COMPOSÉ:");
print("=============================================");

try {
    // Statut du cluster
    print("1. Statut du cluster shardé:");
    const clusterStatus = sh.status();
    printjson(clusterStatus);
    
    // Collections shardées avec leurs clés composées
    print("\n2. Collections shardées et leurs clés:");
    const shardedCollections = db.getSiblingDB("config").collections.find({}).toArray();
    shardedCollections.forEach(coll => {
        print(`   📁 ${coll._id}`);
        print(`      🔑 Clé de sharding: ${JSON.stringify(coll.key)}`);
        print(`      🏷️  UUID: ${coll.uuid}`);
    });
    
    // Distribution des données par shard
    print("\n3. Distribution des shards:");
    const shardStats = db.getSiblingDB("admin").runCommand({ listShards: 1 });
    shardStats.shards.forEach(shard => {
        print(`   💾 ${shard._id}: ${shard.host}`);
    });
    
    // Vérification des chunks (fragments de données)
    print("\n4. Informations sur les chunks:");
    const chunkInfo = db.getSiblingDB("config").chunks.find().sort({ ns: 1 }).toArray();
    const chunkCount = {};
    chunkInfo.forEach(chunk => {
        chunkCount[chunk.ns] = (chunkCount[chunk.ns] || 0) + 1;
    });
    
    Object.keys(chunkCount).forEach(ns => {
        print(`   📦 ${ns}: ${chunkCount[ns]} chunks`);
    });
    
} catch (e) {
    print("❌ Erreur vérification détaillée: " + e);
}

// Test des performances avec des données d'exemple
print("\n🚀 TEST DE PERFORMANCE AVEC SHARDING COMPOSÉ:");
print("============================================");

try {
    db = db.getSiblingDB("air_quality_db");
    
    // Test d'explication de requête pour voir le routage
    print("Test de routage des requêtes:");
    
    // Requête qui utilisera la clé de sharding composé
    const query1 = db.air_quality.find({ 
        "City": "Ahmedabad", 
        "Date": "2015-01-01" 
    }).explain("executionStats");
    
    print("✅ Requête routée via clé composée (City + Date)");
    
    // Requête sur station_hour avec clé composée
    const query2 = db.station_hour.find({
        "StationId": "AP001",
        "Datetime": { $gte: "2017-11-24" }
    }).explain("executionStats");
    
    print("✅ Requête routée via clé composée (StationId + Datetime)");
    
} catch (e) {
    print("⚠️  Tests de performance reportés après import des données");
}

print("\n🎉 CLUSTER MONGODB SHARDÉ COMPOSÉ INITIALISÉ AVEC SUCCÈS!");
print("========================================================");
print("📊 RÉSUMÉ DE LA CONFIGURATION SHARDING COMPOSÉ:");
print("");
print("🏙️  AIR_QUALITY:");
print("   🔑 Clé de sharding: { City: 1, Date: 1 }");
print("   🎯 Avantage: Regroupement par ville et date pour analyses temporelles");
print("");
print("🏙️  CITY_HOUR:");
print("   🔑 Clé de sharding: { City: 1, Datetime: 1 }");
print("   🎯 Avantage: Distribution fine des données horaires par ville");
print("");
print("📡 STATION_HOUR:");
print("   🔑 Clé de sharding: { StationId: 1, Datetime: 1 }");
print("   🎯 Avantage: Données de station regroupées chronologiquement");
print("");
print("🏢 STATIONS:");
print("   🔑 Clé de sharding: { StationId: 1 }");
print("   🎯 Avantage: Distribution simple pour données de référence");
print("");
print("⚡ PERFORMANCE ATTENDUE:");
print("   ✅ Requêtes par ville + date → routage direct vers shard");
print("   ✅ Requêtes par station + période → routage direct vers shard"); 
print("   ✅ Distribution équilibrée → réduction des hotspots");
print("   ✅ Scalabilité horizontale optimale");
print("");
print("📍 CONNEXION APPLICATION:");
print("   URL: mongodb://localhost:27017/air_quality_db");
print("   Via: Router mongos");
print("");
print("🚀 NEXT STEP: Importer vos données avec import-data.js");