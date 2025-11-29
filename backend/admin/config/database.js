const { MongoClient } = require('mongodb');
require('dotenv').config();

class Database {
    constructor() {
        this.client = null;
        this.db = null;
    }

    async connect() {
        try {
            // Connection string for mongos router
            const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
            
            this.client = new MongoClient(connectionString, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });

            await this.client.connect();
            this.db = this.client.db('air_quality_db');
            
            console.log('Connected to MongoDB through mongos');
            return this.db;
        } catch (error) {
            console.error('Database connection error:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            console.log('Disconnected from MongoDB');
        }
    }

    getCollection(collectionName) {
        if (!this.db) {
            throw new Error('Database not connected');
        }
        return this.db.collection(collectionName);
    }
}

module.exports = new Database();