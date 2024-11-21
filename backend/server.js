import { WebSocketServer } from "ws";
import http from "http";

// Use PORT environment variable or default to 8080
const PORT = process.env.PORT || 8080;

// Create an HTTP server for health checks
const server = http.createServer((req, res) => {
    if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
    } else {
        res.writeHead(404);
        res.end("Not Found");
    }
});

// Attach WebSocket server to the HTTP server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
    console.log("New client connected");

    ws.on("message", (message) => {
        try {
            // Convert Buffer to string and parse JSON
            const parsedMessage = JSON.parse(message.toString());
            console.log("Received:", parsedMessage);

            // Broadcast the message to all connected clients
            if (parsedMessage.type === "ping") {
                ws.send(JSON.stringify({ type: "pong" })); // Send pong in response to ping
            } else {
                // Broadcast the message to all connected clients
                wss.clients.forEach((client) => {
                    if (client.readyState === ws.OPEN) {
                        client.send(JSON.stringify(parsedMessage));
                    }
                });
            }
        } catch (error) {
            console.error("Error parsing message:", error);
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
    });
});

// Start the HTTP server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
