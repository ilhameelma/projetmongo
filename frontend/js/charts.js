
 // Variables globales
let currentCharts = {};
let currentFilters = {
    city: 'all',
    year: 'all', 
    season: 'all'
};

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
        const response = await fetch('/api/stats/global');
        if (!response.ok) throw new Error('Erreur API: ' + response.status);
        const stats = await response.json();
        
        document.getElementById('pm25-value').textContent = `${stats.pm25 ? stats.pm25.toFixed(1) : 'N/A'} μg/m³`;
        document.getElementById('pm10-value').textContent = `${stats.pm10 ? stats.pm10.toFixed(1) : 'N/A'} μg/m³`;
        document.getElementById('aqi-value').textContent = stats.aqi ? Math.round(stats.aqi) : 'N/A';
        document.getElementById('stations-value').textContent = stats.activeStations || 'N/A';
        
        // Mettre à jour les tendances
        document.getElementById('pm25-trend').textContent = 'Données en direct';
        document.getElementById('pm10-trend').textContent = 'Données en direct';
        document.getElementById('aqi-trend').textContent = 'Données en direct';
        document.getElementById('stations-trend').textContent = 'Réseau actif';
        
    } catch (error) {
        console.error('Erreur chargement stats globales:', error);
        throw error;
    }
}

// Graphique d'évolution de la pollution
async function createPollutionChart() {
    try {
        const response = await fetch('/api/stats/trends');
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
                    },
                    {
                        label: 'AQI',
                        data: trends.map(t => t.aqi || 0),
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.3,
                        fill: false,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Valeur'
                        }
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
        const response = await fetch('/api/stations/status');
        if (!response.ok) throw new Error('Erreur API status');
        const statusData = await response.json();
        
        const ctx = document.getElementById('stationsStatusChart').getContext('2d');
        
        if (currentCharts.stationsStatusChart) {
            currentCharts.stationsStatusChart.destroy();
        }
        
        // Filtrer les données pour éviter les valeurs nulles
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
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = filteredData.reduce((sum, s) => sum + (s.count || 0), 0);
                                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
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
        const response = await fetch('/api/search?city=all&year=all');
        if (!response.ok) throw new Error('Erreur API cities');
        const cityData = await response.json();
        
        const ctx = document.getElementById('cityPollutionChart').getContext('2d');
        
        if (currentCharts.cityPollutionChart) {
            currentCharts.cityPollutionChart.destroy();
        }
        
        // Trier par AQI décroissant et limiter à 10 villes
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
                    },
                    {
                        label: 'AQI Moyen',
                        data: sortedData.map(c => c.aqi || 0),
                        backgroundColor: 'rgba(52, 152, 219, 0.7)',
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'PM2.5 (μg/m³)'
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'AQI'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
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
        const response = await fetch('/api/stations/by-city');
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
                    backgroundColor: [
                        '#e74c3c', '#e67e22', '#f39c12', '#f1c40f', '#2ecc71', 
                        '#1abc9c', '#3498db', '#9b59b6', '#34495e', '#95a5a6'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Nombre de stations'
                        }
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
        const response = await fetch('/api/stats/seasonal');
        if (!response.ok) throw new Error('Erreur API seasonal');
        const seasonalData = await response.json();
        
        const ctx = document.getElementById('seasonalChart').getContext('2d');
        
        if (currentCharts.seasonalChart) {
            currentCharts.seasonalChart.destroy();
        }
        
        const seasons = ['Hiver', 'Printemps', 'Été', 'Automne'];
        
        currentCharts.seasonalChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: seasons,
                datasets: [
                    {
                        label: 'PM2.5 (μg/m³)',
                        data: seasonalData.map(s => s.pm25 || 0),
                        backgroundColor: 'rgba(231, 76, 60, 0.7)',
                    },
                    {
                        label: 'AQI',
                        data: seasonalData.map(s => s.aqi || 0),
                        backgroundColor: 'rgba(52, 152, 219, 0.7)',
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Valeur'
                        }
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
        const response = await fetch('/api/stats/aqi-distribution');
        if (!response.ok) throw new Error('Erreur API AQI distribution');
        const distribution = await response.json();
        
        const ctx = document.getElementById('aqiDistributionChart').getContext('2d');
        
        if (currentCharts.aqiDistributionChart) {
            currentCharts.aqiDistributionChart.destroy();
        }
        
        // Mapper les catégories AQI
        const categoryMap = {
            'Good': 'Bon',
            'Satisfactory': 'Satisfaisant', 
            'Moderate': 'Modéré',
            'Poor': 'Mauvais',
            'Very Poor': 'Très Mauvais',
            'Severe': 'Sévère'
        };
        
        // Filtrer les données valides
        const filteredDistribution = distribution.filter(d => d._id && d.count > 0);
        
        currentCharts.aqiDistributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: filteredDistribution.map(d => categoryMap[d._id] || d._id),
                datasets: [{
                    data: filteredDistribution.map(d => d.count || 0),
                    backgroundColor: [
                        '#27ae60', // Good - Vert
                        '#f1c40f', // Moderate - Jaune
                        '#e67e22', // Poor - Orange
                        '#e74c3c', // Very Poor - Rouge
                        '#c0392b'  // Severe - Rouge foncé
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = filteredDistribution.reduce((sum, d) => sum + (d.count || 0), 0);
                                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
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
        const response = await fetch('/api/stations/top-polluted');
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
                    Aucune donnée disponible
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = stations.map((station, index) => {
        const isHighPm25 = station.pm25 > 150;
        const isHighPm10 = station.pm10 > 250;
        const isHighAqi = station.aqi > 300;
        
        return `
        <tr>
            <td><strong>${station.station || 'N/A'}</strong></td>
            <td>${station.city || 'Ville inconnue'}</td>
            <td class="${isHighPm25 ? 'high-value' : ''}">${station.pm25 ? station.pm25.toFixed(1) : 'N/A'}</td>
            <td class="${isHighPm10 ? 'high-value' : ''}">${station.pm10 ? station.pm10.toFixed(1) : 'N/A'}</td>
            <td class="${isHighAqi ? 'high-value' : ''}">${station.aqi || 'N/A'}</td>
            <td><span class="aqi-badge aqi-${(station.category || 'unknown').toLowerCase().replace(' ', '-')}">${station.category || 'Inconnu'}</span></td>
        </tr>
    `}).join('');
    
    updateTableStats(stations);
}

function updateTableStats(stations) {
    let statsElement = document.querySelector('.table-stats');
    
    if (!statsElement) {
        statsElement = document.createElement('div');
        statsElement.className = 'table-stats';
        const table = document.querySelector('.data-table table');
        table.parentNode.insertBefore(statsElement, table.nextSibling);
    }
    
    if (!stations || stations.length === 0) {
        statsElement.innerHTML = '';
        return;
    }
    
    const severeCount = stations.filter(s => s.category === 'Severe').length;
    const veryPoorCount = stations.filter(s => s.category === 'Very Poor').length;
    const delhiCount = stations.filter(s => s.city === 'Delhi').length;
    const avgPM25 = stations.reduce((sum, s) => sum + (s.pm25 || 0), 0) / stations.length;
    const avgAQI = stations.reduce((sum, s) => sum + (s.aqi || 0), 0) / stations.length;
    
    statsElement.innerHTML = `
        <div style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #f8f9fa, #e9ecef); border-radius: 10px; border-left: 4px solid var(--accent);">
            <strong>Analyse du Top 10 :</strong>
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>${severeCount} stations en catégorie "Severe"</li>
                <li>${veryPoorCount} stations en catégorie "Very Poor"</li>
                <li>${delhiCount} stations à Delhi dans le Top 10</li>
                <li>PM2.5 moyen: ${avgPM25.toFixed(1)} μg/m³</li>
                <li>AQI moyen: ${Math.round(avgAQI)}</li>
            </ul>
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
        
        if (data.status === 'OK') {
            statusElement.innerHTML = '<span style="color: #27ae60;">Connecté</span>';
            statusElement.innerHTML += ` (${data.database})`;
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
            backgroundColor: '#95a5a6',
            borderColor: '#7f8c8d',
            borderWidth: 1
        }]
    };
    
    currentCharts[canvasId] = new Chart(ctx, {
        type: type,
        data: fallbackData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
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
    
    try {
        await updateStatistics(city, year, season);
        await refreshCharts();
        hideLoading();
    } catch (error) {
        hideLoading();
        showError('Erreur lors de la mise à jour: ' + error.message);
    }
}

async function updateStatistics(city, year, season) {
    try {
        let url = '/api/stats/global';
        if (city !== 'all') {
            url = `/api/cities/${city}?year=${year}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Erreur API statistics');
        const stats = await response.json();
        
        if (city !== 'all') {
            // Données spécifiques à la ville
            document.getElementById('pm25-value').textContent = `${stats.avgPM25 ? stats.avgPM25.toFixed(1) : 'N/A'} μg/m³`;
            document.getElementById('pm10-value').textContent = `${stats.avgPM10 ? stats.avgPM10.toFixed(1) : 'N/A'} μg/m³`;
            document.getElementById('aqi-value').textContent = stats.avgAQI ? Math.round(stats.avgAQI) : 'N/A';
            document.getElementById('stations-value').textContent = stats.records || 'N/A';
        } else {
            // Données globales
            document.getElementById('pm25-value').textContent = `${stats.pm25 ? stats.pm25.toFixed(1) : 'N/A'} μg/m³`;
            document.getElementById('pm10-value').textContent = `${stats.pm10 ? stats.pm10.toFixed(1) : 'N/A'} μg/m³`;
            document.getElementById('aqi-value').textContent = stats.aqi ? Math.round(stats.aqi) : 'N/A';
            document.getElementById('stations-value').textContent = stats.activeStations || 'N/A';
        }
    } catch (error) {
        console.error('Erreur mise à jour statistiques:', error);
        throw error;
    }
}

async function refreshCharts() {
    // Recréer tous les graphiques avec les nouveaux filtres
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
    
    // Mettre à jour le statut toutes les 30 secondes
    setInterval(updateAPIStatus, 30000);
});