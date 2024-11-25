import sqlite3 from 'sqlite3';

// Enable verbose mode for SQLite
sqlite3.verbose();

// Connect to the database
const db = new sqlite3.Database('./history.db');

// Create a table for storing event data
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            languages TEXT,
            full_translations TEXT
        );

    `);
    console.log('Table initialized!');
});

// Close the database connection (optional for setup scripts)
db.close();
