import { WebSocketServer, WebSocket } from "ws";
import sqlite3 from "sqlite3";
import express from "express";
import cors from "cors";

const db = new sqlite3.Database("./history.db");
const wss = new WebSocketServer({ port: 8080 });
const app = express();

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            languages TEXT,
            full_translations TEXT
        )
    `, (err) => {
        if (err) {
            console.error("Error initializing database:", err.message);
        } else {
            console.log("Database initialized successfully");
        }
    });
});


wss.on("connection", (ws) => {
    console.log("New WebSocket connection established");

    ws.on("message", (message) => {
        try {
            const parsedMessage = JSON.parse(message.toString());
            const { sessionId, languages, fullTranslations } = parsedMessage;

            console.log("Parsed WebSocket message:", parsedMessage);

            if (sessionId) {
                // Save session data to DB
                db.run(
                    `
                    INSERT OR REPLACE INTO sessions (session_id, languages, full_translations)
                    VALUES (?, ?, ?)
                    `,
                    [
                        sessionId,
                        JSON.stringify(languages || []),
                        JSON.stringify(fullTranslations || {}),
                    ],
                    (err) => {
                        if (err) {
                            console.error("Error saving session to DB:", err.message);
                        } else {
                            console.log(`Session saved successfully for sessionId=${sessionId}`);
                        }
                    }
                );
            }

            // Broadcast the message to all connected clients
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    console.log("Broadcasting message:", parsedMessage);
                    client.send(JSON.stringify(parsedMessage));
                }
            });
        } catch (error) {
            console.error("Error parsing WebSocket message:", error);
        }
    });

    ws.on("close", () => {
        console.log("WebSocket connection closed");
    });

    ws.on("error", (error) => {
        console.error("WebSocket error:", error);
    });
});





app.use(express.json());

app.use(
    cors({
        origin: "http://localhost:5173", // Allow only your frontend origin
    })
);

app.post("/api/create-session", (req, res) => {
    const { sessionId } = req.body;
  
    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" });
    }
  
    db.run(
      `
      INSERT OR REPLACE INTO sessions (session_id, languages, full_translations)
      VALUES (?, ?, ?)
      `,
      [sessionId, JSON.stringify([]), JSON.stringify({})],
      (err) => {
        if (err) {
          console.error("Error creating session:", err.message);
          return res.status(500).json({ error: "Database error: " + err.message });
        }
        console.log(`Session created: ${sessionId}`);
        return res.status(201).json({ message: "Session created successfully" });
      }
    );
  });
  
  

// Endpoint to fetch session data
app.get("/api/session-data", (req, res) => {
    const { sessionId } = req.query;
  
    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" });
    }
  
    db.get(
      "SELECT languages, full_translations FROM sessions WHERE session_id = ?",
      [sessionId],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: "Database error: " + err.message });
        }
        if (!row) {
          return res.status(404).json({ error: "Session not found" });
        }
  
        return res.json({
          languages: JSON.parse(row.languages || "[]"),
          fullTranslations: JSON.parse(row.full_translations || "{}"),
        });
      }
    );
  });
  


// Start HTTP server
app.listen(3000, () => {
    console.log("HTTP server running on http://localhost:3000");
});

console.log("WebSocket server running on wss://websocket-server-549270727339.us-central1.run.app");
