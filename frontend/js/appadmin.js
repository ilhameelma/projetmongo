let currentStationsPage = 1;
let currentAirQualityPage = 1;
const itemsPerPage = 10;
const API_BASE = '/api/admin';
// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    loadStats();
    loadStations();
    loadAirQualityData();
    loadFilters();
});

// Tab navigation
function openTab(tabName) {
    // Hide all tab content
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove('active');
    }

    // Remove active class from all buttons
    const tabButtons = document.getElementsByClassName('tab-button');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove('active');
    }

    // Show specific tab content and activate button
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// Load database statistics
// Load database statistics - CORRIGÉ
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`);
        const data = await response.json();
        
        const statsContainer = document.getElementById('stats');
        statsContainer.innerHTML = '';
        
        // Format adapté à votre nouvelle API
        const statsData = [
            { name: 'Stations', value: data.stationCount || 0 },
            { name: 'Air Quality Data', value: data.airQualityCount || 0 },
            { name: 'Cities', value: data.cityCount || 0 },
            { name: 'Last Update', value: data.lastUpdate ? new Date(data.lastUpdate).toLocaleDateString() : 'N/A' }
        ];
        
        statsData.forEach(stat => {
            const statCard = document.createElement('div');
            statCard.className = 'stat-card';
            statCard.innerHTML = `
                <h3>${stat.name}</h3>
                <div class="count">${stat.value}</div>
            `;
            statsContainer.appendChild(statCard);
        });
        
    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('stats').innerHTML = '<div class="error">Error loading statistics</div>';
    }
}

// Stations management - CORRIGÉ
async function loadStations(page = 1) {
    try {
        const search = document.getElementById('stationSearch').value;
        const response = await fetch(`${API_BASE}/stations?page=${page}&limit=${itemsPerPage}&search=${encodeURIComponent(search)}`);
        const data = await response.json();
        
        displayStations(data.stations);
        displayPagination('stationsPagination', {
            page: data.currentPage,
            pages: data.totalPages,
            total: data.total
        }, loadStations);
        
    } catch (error) {
        console.error('Error loading stations:', error);
        document.getElementById('stationsTable').innerHTML = '<p>Error loading stations</p>';
    }
}


function displayStations(stations) {
    const tableContainer = document.getElementById('stationsTable');
    
    if (stations.length === 0) {
        tableContainer.innerHTML = '<p>No stations found</p>';
        return;
    }

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Station ID</th>
                    <th>City</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    stations.forEach(station => {
        tableHTML += `
            <tr>
                <td>${station.StationId}</td>
                <td>${station.City}</td>
                <td>${station.Latitude}</td>
                <td>${station.Longitude}</td>
                <td class="action-buttons">
                    <button class="btn-edit" onclick="editStation('${station.StationId}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-delete" onclick="deleteStation('${station.StationId}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = tableHTML;
}

// Air Quality data management
async function loadAirQualityData(page = 1) {
    try {
        const city = document.getElementById('cityFilter').value;
        const date = document.getElementById('dateFilter').value;
        
        const response = await fetch(`${API_BASE}/air-quality?page=${page}&limit=${itemsPerPage}&city=${encodeURIComponent(city)}&date=${encodeURIComponent(date)}`);
        const data = await response.json();
        
        displayAirQualityData(data.data);
        displayPagination('airQualityPagination', {
            page: data.currentPage,
            pages: data.totalPages,
            total: data.total
        }, loadAirQualityData);
        
    } catch (error) {
        console.error('Error loading air quality data:', error);
        document.getElementById('airQualityTable').innerHTML = '<p>Error loading air quality data</p>';
    }
}

function displayAirQualityData(data) {
    const tableContainer = document.getElementById('airQualityTable');
    
    if (data.length === 0) {
        tableContainer.innerHTML = '<p>No air quality data found</p>';
        return;
    }

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>City</th>
                    <th>Date</th>
                    <th>PM2.5</th>
                    <th>PM10</th>
                    <th>NO</th>
                    <th>NO2</th>
                    <th>NOx</th>
                    <th>NH3</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(item => {
        tableHTML += `
            <tr>
                <td>${item.City}</td>
                <td>${item.Date}</td>
                <td>${item.PM2_5 || 'N/A'}</td>
                <td>${item.PM10 || 'N/A'}</td>
                <td>${item.NO || 'N/A'}</td>
                <td>${item.NO2 || 'N/A'}</td>
                <td>${item.NOx || 'N/A'}</td>
                <td>${item.NH3 || 'N/A'}</td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = tableHTML;
}

// Load filters
async function loadFilters() {
    try {
        // Load cities
        const citiesResponse = await fetch(`${API_BASE}/filters/cities`);
        const citiesResult = await citiesResponse.json();
        
        if (citiesResult.success) {
            const cityFilter = document.getElementById('cityFilter');
            const testCity = document.getElementById('testCity');
            
            // Vider les selects existants
            cityFilter.innerHTML = '<option value="">All Cities</option>';
            testCity.innerHTML = '<option value="">Select City</option>';
            
            citiesResult.data.forEach(city => {
                const option1 = new Option(city, city);
                const option2 = new Option(city, city);
                cityFilter.add(option1);
                testCity.add(option2);
            });
        }

        // Load stations
        const stationsResponse = await fetch(`${API_BASE}/filters/stations`);
        const stationsResult = await stationsResponse.json();
        
        if (stationsResult.success) {
            const testStation = document.getElementById('testStation');
            testStation.innerHTML = '<option value="">Select Station</option>';
            
            stationsResult.data.forEach(station => {
                const option = new Option(station, station);
                testStation.add(option);
            });
        }
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

// Performance tests
async function runCityPerformanceTest() {
    const city = document.getElementById('testCity').value;
    if (!city) {
        alert('Please select a city');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/performance/city-data?city=${encodeURIComponent(city)}`);
        const result = await response.json();
        
        if (result.success) {
            const resultsDiv = document.getElementById('cityTestResults');
            resultsDiv.innerHTML = `
                <strong>Performance Results:</strong><br>
                Execution Time: ${result.data.executionTime}<br>
                Documents Returned: ${result.data.documentsReturned}<br>
                <br><strong>Sample Data:</strong><br>
                <pre>${JSON.stringify(result.data.sampleData, null, 2)}</pre>
            `;
        }
    } catch (error) {
        console.error('Error running performance test:', error);
    }
}

async function runStationPerformanceTest() {
    const stationId = document.getElementById('testStation').value;
    if (!stationId) {
        alert('Please select a station');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/performance/station-data?stationId=${encodeURIComponent(stationId)}`);
        const result = await response.json();
        
        if (result.success) {
            const resultsDiv = document.getElementById('stationTestResults');
            resultsDiv.innerHTML = `
                <strong>Performance Results:</strong><br>
                Execution Time: ${result.data.executionTime}<br>
                Documents Returned: ${result.data.documentsReturned}<br>
                <br><strong>Sample Data:</strong><br>
                <pre>${JSON.stringify(result.data.sampleData, null, 2)}</pre>
            `;
        }
    } catch (error) {
        console.error('Error running performance test:', error);
    }
}





// Station CRUD operations
function showAddStationForm() {
    document.getElementById('modalTitle').textContent = 'Add New Station';
    document.getElementById('stationForm').reset();
    document.getElementById('stationId').value = '';
    openModal('stationModal');
}

async function editStation(stationId) {
    try {
        const response = await fetch(`/api/stations`);
        const result = await response.json();
        
        if (result.success) {
            const station = result.data.find(s => s.StationId === stationId);
            if (station) {
                document.getElementById('modalTitle').textContent = 'Edit Station';
                document.getElementById('stationId').value = station.StationId;
                document.getElementById('StationId').value = station.StationId;
                document.getElementById('City').value = station.City;
                document.getElementById('Latitude').value = station.Latitude;
                document.getElementById('Longitude').value = station.Longitude;
                openModal('stationModal');
            }
        }
    } catch (error) {
        console.error('Error loading station for edit:', error);
    }
}

async function deleteStation(stationId) {
    if (confirm(`Are you sure you want to delete station ${stationId}?`)) {
        try {
            const response = await fetch(`/api/stations/${stationId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (result.success) {
                alert('Station deleted successfully');
                loadStations();
                loadStats();
            } else {
                alert('Error deleting station: ' + result.message);
            }
        } catch (error) {
            console.error('Error deleting station:', error);
            alert('Error deleting station');
        }
    }
}

// Station form submission
document.getElementById('stationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = {
        StationId: document.getElementById('StationId').value,
        City: document.getElementById('City').value,
        Latitude: parseFloat(document.getElementById('Latitude').value),
        Longitude: parseFloat(document.getElementById('Longitude').value)
    };

    const stationId = document.getElementById('stationId').value;
    const url = stationId ? `/api/stations/${stationId}` : '/api/stations';
    const method = stationId ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(stationId ? 'Station updated successfully' : 'Station created successfully');
            closeModal('stationModal');
            loadStations();
            loadStats();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error saving station:', error);
        alert('Error saving station');
    }
});

// Utility functions
function displayPagination(containerId, pagination, loadFunction) {
    const container = document.getElementById(containerId);
    const { page, pages } = pagination;
    
    let paginationHTML = '';
    
    if (page > 1) {
        paginationHTML += `<button class="page-btn" onclick="${loadFunction.name}(${page - 1})">Previous</button>`;
    }
    
    for (let i = 1; i <= pages; i++) {
        if (i === page) {
            paginationHTML += `<button class="page-btn active">${i}</button>`;
        } else {
            paginationHTML += `<button class="page-btn" onclick="${loadFunction.name}(${i})">${i}</button>`;
        }
    }
    
    if (page < pages) {
        paginationHTML += `<button class="page-btn" onclick="${loadFunction.name}(${page + 1})">Next</button>`;
    }
    
    container.innerHTML = paginationHTML;
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function searchStations() {
    currentStationsPage = 1;
    loadStations();
}

function filterAirQuality() {
    currentAirQualityPage = 1;
    loadAirQualityData();
}