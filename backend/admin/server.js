const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const database = require('./config/database');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 4000;


// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../../frontend')));

// API Routes
app.use('/api', apiRoutes);

// Routes pour servir l'interface admin
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend', 'indexadmin.html'));
});

// Route alternative
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend', 'indexadmin.html'));
});

// Initialize database connection and start server
async function startServer() {
    try {
        await database.connect();
        app.listen(PORT, () => {
            console.log(`Backend server running on http://localhost:${PORT}`);
            console.log('Admin interface available at:');
            console.log('  http://localhost:4000');
            console.log('  http://localhost:4000/admin');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await database.disconnect();
    process.exit(0);
});

startServer();