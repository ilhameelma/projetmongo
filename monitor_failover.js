// monitor_failover.js
function measureFailover() {
    const results = {
        startTime: new Date(),
        events: [],
        failoverDetected: false,
        failoverTime: null
    };
    
    // 1. Identifier le config server primary actuel
    print("=== IDENTIFICATION DU PRIMARY ===");
    try {
        const configConn = new Mongo("config1:27017");
        const adminDb = configConn.getDB("admin");
        const status = adminDb.runCommand({ replSetGetStatus: 1 });
        
        const primary = status.members.find(m => m.state === 1);
        results.initialPrimary = primary ? primary.name : "inconnu";
        print(`📌 Config server primary initial: ${results.initialPrimary}`);
    } catch(e) {
        print(`❌ Impossible de déterminer le primary: ${e.message}`);
    }
    
    // 2. Démarrer la surveillance continue
    print("\n=== DÉBUT SURVEILLANCE ===");
    print("Appuyez sur Ctrl+C pour arrêter");
    
    let checkCount = 0;
    const checkInterval = 500; // ms
    
    const monitor = setInterval(() => {
        checkCount++;
        const checkTime = new Date();
        
        try {
            // Essayer de se connecter à config1
            const conn = new Mongo("config1:27017");
            const isUp = conn.getDB("admin").runCommand({ ping: 1 }).ok === 1;
            
            if (!isUp && !results.failoverDetected) {
                results.failoverDetected = true;
                results.failoverTime = checkTime;
                results.downtimeStart = checkTime;
                
                print(`\n🚨 CONFIG1 DOWN détecté à: ${checkTime.toISOString()}`);
                print(`   Temps depuis début: ${checkCount * checkInterval}ms`);
                
                // Détecter le nouveau primary
                detectNewPrimary(results);
            }
            
            if (isUp && results.failoverDetected) {
                results.recoveryTime = checkTime;
                const totalDowntime = results.recoveryTime - results.downtimeStart;
                
                print(`\n✅ CONFIG1 UP à: ${checkTime.toISOString()}`);
                print(`   Temps d'indisponibilité: ${totalDowntime}ms`);
                printResults(results);
                clearInterval(monitor);
            }
            
        } catch (error) {
            // config1 est down
            if (!results.failoverDetected) {
                results.failoverDetected = true;
                results.failoverTime = new Date();
                results.downtimeStart = results.failoverTime;
                
                print(`\n🚨 CONFIG1 INACCESSIBLE (${error.message})`);
                print(`   Temps de détection: ${checkCount * checkInterval}ms`);
                
                detectNewPrimary(results);
            }
        }
    }, checkInterval);
    
    return results;
}

function detectNewPrimary(results) {
    print("\n🔍 Recherche du nouveau primary...");
    
    // Essayer config2 et config3
    const configs = ["config2:27017", "config3:27017"];
    
    for (const config of configs) {
        try {
            const conn = new Mongo(config);
            const adminDb = conn.getDB("admin");
            const status = adminDb.runCommand({ replSetGetStatus: 1 });
            
            const newPrimary = status.members.find(m => m.state === 1);
            if (newPrimary) {
                results.newPrimary = newPrimary.name;
                results.newPrimaryDetectedTime = new Date();
                results.failoverDuration = results.newPrimaryDetectedTime - results.failoverTime;
                
                print(`✅ Nouveau primary détecté: ${newPrimary.name}`);
                print(`   Temps de basculement: ${results.failoverDuration}ms`);
                break;
            }
        } catch(e) {
            // Ce config n'est pas accessible non plus
        }
    }
}

function printResults(results) {
    print("\n" + "=".repeat(50));
    print("📊 RÉSULTATS DU BASSULEMENT");
    print("=".repeat(50));
    
    if (results.failoverTime && results.newPrimaryDetectedTime) {
        const totalTime = results.newPrimaryDetectedTime - results.startTime;
        const failoverTime = results.newPrimaryDetectedTime - results.failoverTime;
        
        print(`⏱️  Temps total: ${totalTime}ms`);
        print(`⚡ Temps de basculement: ${failoverTime}ms`);
        print(`👑 Primary initial: ${results.initialPrimary}`);
        print(`👑 Nouveau primary: ${results.newPrimary}`);
        print(`📉 Détection de panne: ${results.failoverTime.toISOString()}`);
        print(`📈 Basculement terminé: ${results.newPrimaryDetectedTime.toISOString()}`);
    } else {
        print("❌ Basculement incomplet ou non détecté");
    }
    
    print("\nÉvénements enregistrés:");
    results.events.forEach((event, i) => {
        print(`  ${i+1}. ${event.time.toISOString()} - ${event.message}`);
    });
}

// Exécuter
measureFailover();