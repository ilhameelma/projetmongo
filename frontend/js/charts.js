// Variables globales
let currentCharts = {};
let currentFilters = {
    city: 'all',
    year: 'all', 
    season: 'all'
};
const API_BASE = '/api/stats';

// Initialisation des graphiques avec données réelles
async function initializeCharts() {
    showLoading();
    try {
        await updateAPIStatus();
        await loadGlobalStats();
        await createPollutionChart();
        await createStationsStatusChart();
        await createCityPollutionChart();
        await createStationsByCityChart();
        await createSeasonalChart();
        await createAqiDistributionChart();
        await loadTopStationsTable();
        hideLoading();
    } catch (error) {
        hideLoading();
        showError('Erreur lors du chargement initial des données: ' + error.message);
    }
}

// Charger les statistiques globales
async function loadGlobalStats() {
    try {
        const response = await fetch(`${API_BASE}/global`);
        if (!response.ok) throw new Error('Erreur API: ' + response.status);
        const stats = await response.json();
        
        document.getElementById('pm25-value').textContent = `${stats.pm25 ? stats.pm25.toFixed(1) : 'N/A'} μg/m³`;
        document.getElementById('pm10-value').textContent = `${stats.pm10 ? stats.pm10.toFixed(1) : 'N/A'} μg/m³`;
        document.getElementById('aqi-value').textContent = stats.aqi ? Math.round(stats.aqi) : 'N/A';
        document.getElementById('stations-value').textContent = stats.activeStations || 'N/A';
        
    } catch (error) {
        console.error('Erreur chargement stats globales:', error);
        throw error;
    }
}

// Graphique d'évolution de la pollution
async function createPollutionChart() {
    try {
        const response = await fetch(`${API_BASE}/trends`);
        if (!response.ok) throw new Error('Erreur API trends');
        const trends = await response.json();
        
        const ctx = document.getElementById('pollutionChart').getContext('2d');
        
        if (currentCharts.pollutionChart) {
            currentCharts.pollutionChart.destroy();
        }
        
        currentCharts.pollutionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trends.map(t => t._id || 'N/A'),
                datasets: [
                    {
                        label: 'PM2.5 (μg/m³)',
                        data: trends.map(t => t.pm25 || 0),
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        tension: 0.3,
                        fill: true,
                        borderWidth: 3
                    },
                    {
                        label: 'PM10 (μg/m³)',
                        data: trends.map(t => t.pm10 || 0),
                        borderColor: '#f39c12',
                        backgroundColor: 'rgba(243, 156, 18, 0.1)',
                        tension: 0.3,
                        fill: true,
                        borderWidth: 3
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur création graphique pollution:', error);
        createFallbackChart('pollutionChart', 'line', 'Évolution de la Pollution');
    }
}

// Graphique statut des stations
async function createStationsStatusChart() {
    try {
        const response = await fetch(`${API_BASE}/stations/status`);
        if (!response.ok) throw new Error('Erreur API status');
        const statusData = await response.json();
        
        const ctx = document.getElementById('stationsStatusChart').getContext('2d');
        
        if (currentCharts.stationsStatusChart) {
            currentCharts.stationsStatusChart.destroy();
        }
        
        const filteredData = statusData.filter(item => item._id && item.count > 0);
        
        currentCharts.stationsStatusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: filteredData.map(s => {
                    const statusMap = {
                        'Active': 'Actives',
                        'Inactive': 'Inactives', 
                        'Unknown': 'Inconnues'
                    };
                    return statusMap[s._id] || s._id;
                }),
                datasets: [{
                    data: filteredData.map(s => s.count || 0),
                    backgroundColor: ['#2ecc71', '#e74c3c', '#f39c12', '#3498db'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur création graphique statut stations:', error);
        createFallbackChart('stationsStatusChart', 'doughnut', 'Statut des Stations');
    }
}

// Graphique pollution par ville
async function createCityPollutionChart() {
    try {
        const response = await fetch(`${API_BASE}/search?city=all`);
        if (!response.ok) throw new Error('Erreur API cities');
        const cityData = await response.json();
        
        const ctx = document.getElementById('cityPollutionChart').getContext('2d');
        
        if (currentCharts.cityPollutionChart) {
            currentCharts.cityPollutionChart.destroy();
        }
        
        const sortedData = cityData
            .filter(city => city._id && city.pm25 > 0)
            .sort((a, b) => (b.aqi || 0) - (a.aqi || 0))
            .slice(0, 10);
        
        currentCharts.cityPollutionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedData.map(c => c._id || 'Ville inconnue'),
                datasets: [
                    {
                        label: 'PM2.5 Moyen (μg/m³)',
                        data: sortedData.map(c => c.pm25 || 0),
                        backgroundColor: 'rgba(231, 76, 60, 0.7)',
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur création graphique villes:', error);
        createFallbackChart('cityPollutionChart', 'bar', 'Pollution par Ville');
    }
}

// Graphique stations par ville
async function createStationsByCityChart() {
    try {
        const response = await fetch(`${API_BASE}/stations/by-city`);
        if (!response.ok) throw new Error('Erreur API stations by city');
        const stationsData = await response.json();
        
        const ctx = document.getElementById('stationsByCityChart').getContext('2d');
        
        if (currentCharts.stationsByCityChart) {
            currentCharts.stationsByCityChart.destroy();
        }
        
        currentCharts.stationsByCityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: stationsData.map(s => s._id || 'Ville inconnue'),
                datasets: [{
                    label: 'Nombre de stations',
                    data: stationsData.map(s => s.count || 0),
                    backgroundColor: '#3498db',
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur création graphique stations par ville:', error);
        createFallbackChart('stationsByCityChart', 'bar', 'Stations par Ville');
    }
}

// Graphique saisonnier
async function createSeasonalChart() {
    try {
        const response = await fetch(`${API_BASE}/seasonal`);
        if (!response.ok) throw new Error('Erreur API seasonal');
        const seasonalData = await response.json();
        
        const ctx = document.getElementById('seasonalChart').getContext('2d');
        
        if (currentCharts.seasonalChart) {
            currentCharts.seasonalChart.destroy();
        }
        
        currentCharts.seasonalChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: seasonalData.map(s => s.season),
                datasets: [
                    {
                        label: 'PM2.5 (μg/m³)',
                        data: seasonalData.map(s => s.pm25 || 0),
                        backgroundColor: 'rgba(231, 76, 60, 0.7)',
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur création graphique saisonnier:', error);
        createFallbackChart('seasonalChart', 'bar', 'Variation Saisonnière');
    }
}

// Graphique distribution AQI
async function createAqiDistributionChart() {
    try {
        const response = await fetch(`${API_BASE}/aqi-distribution`);
        if (!response.ok) throw new Error('Erreur API AQI distribution');
        const distribution = await response.json();
        
        const ctx = document.getElementById('aqiDistributionChart').getContext('2d');
        
        if (currentCharts.aqiDistributionChart) {
            currentCharts.aqiDistributionChart.destroy();
        }
        
        const filteredDistribution = distribution.filter(d => d._id && d.count > 0);
        
        currentCharts.aqiDistributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: filteredDistribution.map(d => d._id),
                datasets: [{
                    data: filteredDistribution.map(d => d.count || 0),
                    backgroundColor: ['#27ae60', '#f1c40f', '#e67e22', '#e74c3c', '#c0392b'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur création graphique distribution AQI:', error);
        createFallbackChart('aqiDistributionChart', 'doughnut', 'Distribution AQI');
    }
}

// Charger le tableau Top 10
async function loadTopStationsTable() {
    try {
        const response = await fetch(`${API_BASE}/stations/top-polluted`);
        if (!response.ok) throw new Error('Erreur API top stations');
        const topStations = await response.json();
        
        renderTop10Table(topStations);
        
    } catch (error) {
        console.error('Erreur chargement top stations:', error);
        document.getElementById('top-stations-body').innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erreur de chargement des données</p>
                </td>
            </tr>
        `;
    }
}

function renderTop10Table(stations) {
    const tbody = document.getElementById('top-stations-body');
    
    if (!stations || stations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <i class="fas fa-info-circle" style="color: #3498db; font-size: 2em; margin-bottom: 10px;"></i>
                    <p>Aucune donnée de station disponible</p>
                    <small>Vérifiez que votre base de données contient des données de stations</small>
                </td>
            </tr>
        `;
        return;
    }
    
    console.log('📊 Stations à afficher:', stations);
    
    tbody.innerHTML = stations.map((station, index) => {
        // Couleurs pour les catégories AQI
        const categoryColors = {
            'Good': '#27ae60',
            'Satisfactory': '#2ecc71', 
            'Moderate': '#f1c40f',
            'Poor': '#e67e22',
            'Very Poor': '#e74c3c',
            'Severe': '#c0392b',
            'Inconnu': '#95a5a6'
        };
        
        const categoryColor = categoryColors[station.category] || '#95a5a6';
        const isHighPollution = station.pm25 > 100 || station.aqi > 200;
        
        return `
        <tr style="${isHighPollution ? 'background-color: #fff5f5;' : ''}">
            <td><strong>${station.station || `Station_${index + 1}`}</strong></td>
            <td>${station.city || 'Ville inconnue'}</td>
            <td style="font-weight: bold; color: ${station.pm25 > 100 ? '#e74c3c' : '#2c3e50'}">
                ${station.pm25 ? station.pm25.toFixed(1) : 'N/A'}
            </td>
            <td style="font-weight: bold; color: ${station.pm10 > 200 ? '#e74c3c' : '#2c3e50'}">
                ${station.pm10 ? station.pm10.toFixed(1) : 'N/A'}
            </td>
            <td style="font-weight: bold; color: ${station.aqi > 200 ? '#e74c3c' : '#2c3e50'}">
                ${station.aqi || 'N/A'}
            </td>
            <td>
                <span class="aqi-badge" style="background-color: ${categoryColor}">
                    ${station.category || 'Inconnu'}
                </span>
            </td>
        </tr>
        `;
    }).join('');
    
    // Ajouter des statistiques résumées
    addTableSummary(stations);
}

function addTableSummary(stations) {
    let statsElement = document.querySelector('.table-stats');
    
    if (!statsElement) {
        statsElement = document.createElement('div');
        statsElement.className = 'table-stats';
        const table = document.querySelector('.data-table');
        table.appendChild(statsElement);
    }
    
    if (stations.length === 0) {
        statsElement.innerHTML = '';
        return;
    }
    
    const avgPM25 = stations.reduce((sum, s) => sum + (s.pm25 || 0), 0) / stations.length;
    const avgPM10 = stations.reduce((sum, s) => sum + (s.pm10 || 0), 0) / stations.length;
    const avgAQI = stations.reduce((sum, s) => sum + (s.aqi || 0), 0) / stations.length;
    
    const severeCount = stations.filter(s => s.category === 'Severe').length;
    const veryPoorCount = stations.filter(s => s.category === 'Very Poor').length;
    const poorCount = stations.filter(s => s.category === 'Poor').length;
    
    statsElement.innerHTML = `
        <div style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #f8f9fa, #e9ecef); border-radius: 10px; border-left: 4px solid #e74c3c;">
            <strong>📈 Analyse du Top 10 :</strong>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 10px;">
                <div>
                    <strong>Moyennes :</strong>
                    <div>PM2.5: ${avgPM25.toFixed(1)} μg/m³</div>
                    <div>PM10: ${avgPM10.toFixed(1)} μg/m³</div>
                    <div>AQI: ${Math.round(avgAQI)}</div>
                </div>
                <div>
                    <strong>Catégories :</strong>
                    <div>🔴 Sévère: ${severeCount}</div>
                    <div>🟠 Très mauvais: ${veryPoorCount}</div>
                    <div>🟡 Mauvais: ${poorCount}</div>
                </div>
            </div>
        </div>
    `;
}

// Gestion du chargement et des erreurs
function showLoading() {
    document.getElementById('loadingIndicator').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingIndicator').style.display = 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.querySelector('p').textContent = message;
    errorDiv.style.display = 'block';
}

function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

function retryLoading() {
    hideError();
    initializeCharts();
}

// Mettre à jour le statut de l'API
async function updateAPIStatus() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        const statusElement = document.getElementById('apiStatus');
        const lastUpdateElement = document.getElementById('lastUpdate');
        
        if (data.status === 'healthy') {
            statusElement.innerHTML = '<span style="color: #27ae60;">Connecté</span>';
            statusElement.innerHTML += ` (${data.collections.city_hour} enregistrements)`;
        } else {
            statusElement.innerHTML = '<span style="color: #e74c3c;">Déconnecté</span>';
        }
        
        lastUpdateElement.textContent = new Date().toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
    } catch (error) {
        document.getElementById('apiStatus').innerHTML = '<span style="color: #e74c3c;">Erreur de connexion</span>';
    }
}

// Graphique de fallback en cas d'erreur
function createFallbackChart(canvasId, type, title) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    const fallbackData = {
        labels: ['Donnée 1', 'Donnée 2', 'Donnée 3'],
        datasets: [{
            label: 'Données non disponibles',
            data: [1, 1, 1],
            backgroundColor: '#95a5a6'
        }]
    };
    
    currentCharts[canvasId] = new Chart(ctx, {
        type: type,
        data: fallbackData,
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: '⚠️ ' + title + ' - Données temporairement indisponibles'
                }
            }
        }
    });
}

// Gestion des filtres
function setupFilters() {
    document.getElementById('city-select').addEventListener('change', updateDashboard);
    document.getElementById('year-select').addEventListener('change', updateDashboard);
    document.getElementById('season-select').addEventListener('change', updateDashboard);
}

async function updateDashboard() {
    const city = document.getElementById('city-select').value;
    const year = document.getElementById('year-select').value;
    const season = document.getElementById('season-select').value;
    
    currentFilters = { city, year, season };
    
    showLoading();
    hideError();
    
    try {
        console.log('🔄 Mise à jour avec filtres:', currentFilters);
        
        await updateStatistics(city, year, season);
        await refreshCharts();
        
        hideLoading();
        console.log('✅ Mise à jour terminée avec succès');
        
    } catch (error) {
        hideLoading();
        console.error('❌ Erreur mise à jour:', error);
        showError('Erreur lors de la mise à jour: ' + error.message);
    }
}

async function updateStatistics(city, year, season) {
    try {
        let url;
        if (city !== 'all') {
            url = `/api/cities/${city}?year=${year}`;
        } else {
            url = '/api/stats/global';
        }
        
        console.log('🔍 Appel API:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
        }
        
        const stats = await response.json();
        console.log('📊 Données reçues:', stats);
        
        if (city !== 'all') {
            document.getElementById('pm25-value').textContent = `${stats.avgPM25 ? stats.avgPM25.toFixed(1) : 'N/A'} μg/m³`;
            document.getElementById('pm10-value').textContent = `${stats.avgPM10 ? stats.avgPM10.toFixed(1) : 'N/A'} μg/m³`;
            document.getElementById('aqi-value').textContent = stats.avgAQI ? Math.round(stats.avgAQI) : 'N/A';
            document.getElementById('stations-value').textContent = stats.records || 'N/A';
        } else {
            document.getElementById('pm25-value').textContent = `${stats.pm25 ? stats.pm25.toFixed(1) : 'N/A'} μg/m³`;
            document.getElementById('pm10-value').textContent = `${stats.pm10 ? stats.pm10.toFixed(1) : 'N/A'} μg/m³`;
            document.getElementById('aqi-value').textContent = stats.aqi ? Math.round(stats.aqi) : 'N/A';
            document.getElementById('stations-value').textContent = stats.activeStations || 'N/A';
        }
        
    } catch (error) {
        console.error('❌ Erreur mise à jour statistiques:', error);
        throw new Error('Erreur API statistics: ' + error.message);
    }
}

async function refreshCharts() {
    await createPollutionChart();
    await createCityPollutionChart();
    await createSeasonalChart();
    await createAqiDistributionChart();
    await loadTopStationsTable();
}

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    initializeCharts();
    setupFilters();
    
    console.log('Tableau de bord initialisé avec données réelles');
});