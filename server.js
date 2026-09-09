const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Database Configuration
let pool = null;
let dbConnected = false;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  (async () => {
    try {
      const client = await pool.connect();
      console.log("[DB] Conexão com PostgreSQL estabelecida com sucesso.");
      dbConnected = true;

      await client.query(`
        CREATE TABLE IF NOT EXISTS conversions (
          id SERIAL PRIMARY KEY,
          event_name VARCHAR(100) NOT NULL,
          payload JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      client.release();
      console.log("[DB] Tabela 'conversions' verificada/inicializada.");
    } catch (err) {
      console.warn("[DB] Aviso: Não foi possível conectar ao banco de dados imediatamente:", err.message);
    }
  })();
} else {
  console.log("[DB] DATABASE_URL não definida. Modo autônomo.");
}

// Healthcheck endpoints
const healthHandler = async (req, res) => {
  let dbStatus = "not_configured";
  if (pool) {
    try {
      const check = await pool.query("SELECT 1 AS alive");
      dbStatus = check.rows.length ? "connected" : "error";
    } catch (err) {
      dbStatus = "disconnected: " + err.message;
    }
  }

  res.status(200).json({
    status: "healthy",
    project: "reinatus",
    service: "Reinatus - Super Poten Max",
    domain: "reinatus.vx.dev.br",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: dbStatus,
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// Conversion tracking endpoint
app.post("/api/track", async (req, res) => {
  try {
    const { event, details } = req.body;
    if (pool) {
      await pool.query(
        "INSERT INTO conversions (event_name, payload) VALUES ($1, $2)",
        [event || "click", JSON.stringify(details || {})]
      );
    }
    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 [REINATUS] Servidor rodando em http://${HOST}:${PORT}`);
});
