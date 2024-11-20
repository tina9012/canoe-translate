import { WebSocketServer, WebSocket } from "ws"; // Import both WebSocketServer and WebSocket

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
    console.log("New client connected");

    ws.on("message", (message) => {
        try {
            // Convert Buffer to string and parse JSON
            const parsedMessage = JSON.parse(message.toString());
            console.log("Received:", parsedMessage);

            // Broadcast the message to all connected clients
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(parsedMessage));
                }
            });
        } catch (error) {
            console.error("Error parsing message:", error);
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
    });
});

console.log("WebSocket server running on ws://localhost:8080");
