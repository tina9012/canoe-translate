import express from "express";
import path from "path";

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from the 'build' directory
app.use(express.static(path.join(__dirname, "build")));

// Redirect all requests to index.html for React routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
});
