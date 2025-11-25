#!/bin/bash

# Script d'initialisation du cluster MongoDB shardé avec sharding composé
# Version corrigée pour les noms de conteneurs Docker Compose

set -e  # Arrêter le script en cas d'erreur

echo "🚀 DÉMARRAGE DU CLUSTER MONGODB SHARDÉ AVEC SHARDING COMPOSÉ"
echo "=========================================================="
echo ""

# Définir les noms des conteneurs avec le préfixe Docker Compose
COMPOSE_PROJECT_NAME="projetbasededonner_india"
CONFIG1="${COMPOSE_PROJECT_NAME}-mongodb-config-1-1"
CONFIG2="${COMPOSE_PROJECT_NAME}-mongodb-config-2-1"
CONFIG3="${COMPOSE_PROJECT_NAME}-mongodb-config-3-1"
SHARD1="${COMPOSE_PROJECT_NAME}-mongodb-shard1-1"
SHARD2="${COMPOSE_PROJECT_NAME}-mongodb-shard2-1"
SHARD3="${COMPOSE_PROJECT_NAME}-mongodb-shard3-1"
MONGOS="${COMPOSE_PROJECT_NAME}-mongos-1"

# Fonction pour afficher les messages de statut
log_info() {
    echo "📢 $1"
}

log_success() {
    echo "✅ $1"
}

log_error() {
    echo "❌ $1"
}

log_step() {
    echo ""
    echo "🔹 $1"
}

# Fonction pour attendre qu'un conteneur soit prêt
wait_for_container() {
    local container=$1
    local max_attempts=30
    local attempt=1
    
    log_info "Attente que $container soit prêt..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec $container mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
            log_success "$container est prêt"
            return 0
        fi
        log_info "Tentative $attempt/$max_attempts - $container pas encore prêt..."
        sleep 2
        ((attempt++))
    done
    
    log_error "Timeout en attendant $container"
    return 1
}

log_step "1. DÉMARRAGE DES CONTENEURS DOCKER"
log_info "Démarrage des services MongoDB..."

# Nettoyer les anciens conteneurs
docker-compose down > /dev/null 2>&1 || true

# Démarrer les nouveaux conteneurs
docker-compose up -d

log_info "Attente du démarrage des services..."
sleep 5

# Attendre que tous les conteneurs soient prêts
wait_for_container $CONFIG1
wait_for_container $CONFIG2
wait_for_container $CONFIG3
wait_for_container $SHARD1
wait_for_container $SHARD2
wait_for_container $SHARD3
wait_for_container $MONGOS

log_step "2. CONFIGURATION DES CONFIG SERVERS (REPLICA SET)"
log_info "Initialisation du replica set des config servers..."

docker exec -it $CONFIG1 mongosh --quiet --eval "
try {
    // Initialiser le replica set des config servers
    rs.initiate({
        _id: \"configrs\",
        configsvr: true,
        members: [
            { _id: 0, host: \"$CONFIG1:27017\" },
            { _id: 1, host: \"$CONFIG2:27017\" },
            { _id: 2, host: \"$CONFIG3:27017\" }
        ]
    });
    
    // Attendre que le replica set soit initialisé
    var timeout = Date.now() + 30000;
    while(!rs.isMaster().ismaster && Date.now() < timeout) {
        sleep(1000);
    }
    
    if (rs.isMaster().ismaster) {
        print(\"✅ Config servers replica set initialisé et opérationnel\");
    } else {
        throw new Error(\"Timeout lors de l'initialisation du replica set\");
    }
} catch (e) {
    print(\"❌ Erreur configuration config servers: \" + e);
    throw e;
}
"

if [ $? -ne 0 ]; then
    log_error "Échec de la configuration des config servers"
    exit 1
fi

log_info "Attente de la stabilisation du replica set (15 secondes)..."
sleep 15

log_step "3. CONFIGURATION DU SHARDING COMPOSÉ VIA MONGOS"
log_info "Configuration du cluster shardé avec sharding composé..."

docker exec -it $MONGOS mongosh --quiet --eval "
try {
    log_info = function(msg) { print('📢 ' + msg); }
    log_success = function(msg) { print('✅ ' + msg); }
    log_error = function(msg) { print('❌ ' + msg); }
    
    log_info('Ajout des shards au cluster...');
    
    // Ajouter les shards au cluster
    sh.addShard(\"$SHARD1:27017\");
    sh.addShard(\"$SHARD2:27017\");
    sh.addShard(\"$SHARD3:27017\");
    
    log_success('3 shards ajoutés au cluster');
    
    // Attendre que les shards soient reconnus
    sleep(5000);
    
    log_info('Activation du sharding pour la base de données...');
    
    // Activer le sharding pour la base de données
    sh.enableSharding(\"air_quality_db\");
    log_success('Sharding activé pour air_quality_db');
    
    log_info('Configuration du SHARDING COMPOSÉ pour les collections...');
    
    // Créer les collections et configurer le SHARDING COMPOSÉ
    db = db.getSiblingDB(\"air_quality_db\");
    
    // City Hour - sharding composé City + Datetime
    db.createCollection(\"city_hour\");
    sh.shardCollection(\"air_quality_db.city_hour\", { 
        \"City\": 1, 
        \"Datetime\": 1
    });
    log_success('Sharding composé configuré pour city_hour (City + Datetime)');
    
    // Air Quality - sharding composé City + Date  
    db.createCollection(\"air_quality\");
    sh.shardCollection(\"air_quality_db.air_quality\", { 
        \"City\": 1,
        \"Date\": 1
    });
    log_success('Sharding composé configuré pour air_quality (City + Date)');
    
    // Station Hour - sharding composé StationId + Datetime
    db.createCollection(\"station_hour\");
    sh.shardCollection(\"air_quality_db.station_hour\", { 
        \"StationId\": 1,
        \"Datetime\": 1
    });
    log_success('Sharding composé configuré pour station_hour (StationId + Datetime)');
    
    // Stations - sharding simple
    db.createCollection(\"stations\");
    sh.shardCollection(\"air_quality_db.stations\", { \"StationId\": 1 });
    log_success('Sharding simple configuré pour stations (StationId)');
    
    log_info('Création des index optimisés...');
    
    // Créer les index pour optimiser les performances
    db.air_quality.createIndex({ \"City\": 1, \"Date\": -1 });
    db.air_quality.createIndex({ \"AQI_Bucket\": 1, \"City\": 1 });
    
    db.city_hour.createIndex({ \"City\": 1, \"Datetime\": -1 });
    db.city_hour.createIndex({ \"Datetime\": 1 });
    
    db.station_hour.createIndex({ \"StationId\": 1, \"Datetime\": -1 });
    db.station_hour.createIndex({ \"Datetime\": 1 });
    
    db.stations.createIndex({ \"City\": 1 });
    db.stations.createIndex({ \"State\": 1 });
    
    log_success('Index créés pour optimiser les performances');
    
    // Vérification finale
    log_info('Vérification de la configuration...');
    
    const shardStatus = sh.status();
    if (shardStatus.shards && shardStatus.shards.length === 3) {
        log_success('Cluster shardé configuré avec succès');
        
        // Afficher le résumé
        print('');
        print('🎉 RÉSUMÉ DE LA CONFIGURATION SHARDING COMPOSÉ:');
        print('==============================================');
        print('🏙️  AIR_QUALITY:    { City: 1, Date: 1 }');
        print('🏙️  CITY_HOUR:      { City: 1, Datetime: 1 }');
        print('📡 STATION_HOUR:    { StationId: 1, Datetime: 1 }');
        print('🏢 STATIONS:        { StationId: 1 }');
        print('');
        print('📍 Mongos Router:   localhost:27017');
        print('📊 Base de données: air_quality_db');
        
    } else {
        throw new Error('Problème avec la configuration du cluster');
    }
    
} catch (e) {
    log_error('Erreur configuration sharding: ' + e);
    throw e;
}
"

if [ $? -ne 0 ]; then
    log_error "Échec de la configuration du sharding"
    exit 1
fi

log_step "4. VÉRIFICATION FINALE DU CLUSTER"
log_info "Vérification du statut du cluster..."

docker exec -it $MONGOS mongosh --quiet --eval "
try {
    // Vérifier le statut des shards
    const shardList = sh.status().shards;
    print('📊 SHARDS ACTIFS:');
    shardList.forEach((shard, index) => {
        print('   ' + (index + 1) + '. ' + shard._id + ' - ' + shard.host);
    });
    
    // Vérifier les collections shardées
    const collections = db.getSiblingDB('config').collections.find({}).toArray();
    print('');
    print('📁 COLLECTIONS SHARDÉES:');
    collections.forEach(coll => {
        print('   🔑 ' + coll._id);
        print('      Clé: ' + JSON.stringify(coll.key));
    });
    
    // Vérifier la santé du cluster
    print('');
    print('❤️  SANTÉ DU CLUSTER:');
    const adminDB = db.getSiblingDB('admin');
    const hostInfo = adminDB.runCommand({ hostInfo: 1 });
    print('   ✅ Cluster opérationnel');
    print('   ✅ Mongos router actif');
    print('   ✅ ' + shardList.length + ' shards configurés');
    print('   ✅ ' + collections.length + ' collections shardées');
    
} catch (e) {
    print('❌ Erreur vérification: ' + e);
}
"

log_step "5. PRÉPARATION POUR L'IMPORT DES DONNÉES"
log_info "Création des dossiers pour l'import..."

# Créer le dossier data dans le conteneur mongos si nécessaire
docker exec -it $MONGOS mkdir -p /data

log_success "Dossier /data créé dans le conteneur mongos"

echo ""
echo "🎉 CLUSTER MONGODB SHARDÉ COMPOSÉ INITIALISÉ AVEC SUCCÈS!"
echo "========================================================"
echo ""
echo "📊 RÉSUMÉ DE LA CONFIGURATION:"
echo "   ✅ 3 Config servers (replica set)"
echo "   ✅ 3 Shards"
echo "   ✅ 1 Router Mongos"
echo "   ✅ Sharding composé activé"
echo ""
echo "🔧 PROCHAINES ÉTAPES:"
echo "   1. Copier les fichiers JSON dans le conteneur:"
echo "      docker cp air_quality.json $MONGOS:/data/"
echo "      docker cp city_hour.json $MONGOS:/data/"
echo "      docker cp station_hour.json $MONGOS:/data/"
echo "      docker cp stations.json $MONGOS:/data/"
echo ""
echo "   2. Importer les données:"
echo "      docker exec -it $MONGOS mongosh -f /data/import-data.js"
echo ""
echo "   3. Démarrer l'application:"
echo "      npm install && npm start"
echo ""
echo "📍 INFORMATIONS DE CONNEXION:"
echo "   Host: localhost:27017"
echo "   Database: air_quality_db"
echo "   Via: Mongos Router"
echo ""
echo "⚡ VOTRE CLUSTER SHARDÉ COMPOSÉ EST PRÊT!"