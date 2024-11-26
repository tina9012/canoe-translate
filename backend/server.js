import { WebSocketServer } from "ws";
import mysql from "mysql2/promise";
import express from "express";
import cors from "cors";
import http from "http";

import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 3000;

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173", // Update this for your frontend
  })
);

// Configure MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectTimeout: 30000,
});



// Ensure the table exists
async function initializeDatabase() {
  try {
    console.log("Attempting to connect to the database...");

    // Establish a connection from the connection pool
    const connection = await pool.getConnection();
    console.log("Database connection established successfully.");

    // Run the query to create the table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        languages TEXT,
        full_translations TEXT
      )
    `);
    console.log("Sessions table created or already exists.");

    // Release the connection back to the pool
    connection.release();
    console.log("Connection released back to the pool.");
  } catch (err) {
    console.error("Error initializing database:", err.message);
    console.error("Error stack trace:", err.stack);
    process.exit(1); // Exit the process if database initialization fails
  }
}


// API Routes
app.post("/api/create-session", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO sessions (session_id, languages, full_translations) VALUES (?, ?, ?)`,
      [sessionId, JSON.stringify([]), JSON.stringify({})]
    );
    console.log(`Session created: ${sessionId}`);
    res.status(201).json({ message: "Session created successfully" });
  } catch (err) {
    console.error("Error creating session:", err.message);
    res.status(500).json({ error: "Database error: " + err.message });
  }
});

app.get("/api/session-data", async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT languages, full_translations FROM sessions WHERE session_id = ?`,
      [sessionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const { languages, full_translations } = rows[0];
    res.json({
      languages: JSON.parse(languages || "[]"),
      fullTranslations: JSON.parse(full_translations || "{}"),
    });
  } catch (err) {
    console.error("Error fetching session data:", err.message);
    res.status(500).json({ error: "Database error: " + err.message });
  }
});

// Create a shared HTTP server
const server = http.createServer(app);

// Attach WebSocket server to the HTTP server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("New WebSocket connection established");

  ws.on("message", async (message) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      const { sessionId, fullTranslations } = parsedMessage;

      console.log("Parsed WebSocket message:", parsedMessage);

      if (sessionId && fullTranslations) {
        const [rows] = await pool.query(
          `SELECT full_translations FROM sessions WHERE session_id = ?`,
          [sessionId]
        );

        let existingTranslations = {};
        if (rows.length > 0 && rows[0].full_translations) {
          try {
            existingTranslations = JSON.parse(rows[0].full_translations);
          } catch (err) {
            console.error("Error parsing existing translations:", err);
          }
        }

        const updatedTranslations = { ...existingTranslations };
        for (const lang in fullTranslations) {
          const newTranslation = fullTranslations[lang];
          updatedTranslations[lang] =
            (updatedTranslations[lang] || "") + "\n" + newTranslation;
        }

        await pool.query(
          `
          INSERT INTO sessions (session_id, languages, full_translations)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
          languages = VALUES(languages),
          full_translations = VALUES(full_translations)
          `,
          [
            sessionId,
            JSON.stringify(parsedMessage.languages || []),
            JSON.stringify(updatedTranslations),
          ]
        );

        console.log(`Session updated successfully for sessionId=${sessionId}`);
      }

      // Broadcast the message to all connected clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === ws.OPEN) {
          client.send(JSON.stringify(parsedMessage));
        }
      });
    } catch (err) {
      console.error("Error processing WebSocket message:", err);
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

// Start the server and initialize the database
initializeDatabase();

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
