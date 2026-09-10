let Pool = null;
try {
  Pool = require("pg").Pool;
} catch (e) {
  // pg is installed in production Docker environment
}
const fs = require("fs");
const path = require("path");

let pool = null;
let isConnected = false;
let isPostgres = false;

// Local fallback store in case DATABASE_URL is not set
const localStorePath = path.join(__dirname, "..", "data_local.json");
let localData = {
  users: [],
  settings: {},
  pageviews: [],
  clicks: [],
};

if (fs.existsSync(localStorePath)) {
  try {
    localData = JSON.parse(fs.readFileSync(localStorePath, "utf8"));
  } catch (e) {
    console.warn("[DB] Erro ao carregar data_local.json:", e.message);
  }
}

function saveLocalData() {
  try {
    fs.writeFileSync(localStorePath, JSON.stringify(localData, null, 2), "utf8");
  } catch (e) {
    console.warn("[DB] Erro ao salvar data_local.json:", e.message);
  }
}

async function initDB() {
  if (process.env.DATABASE_URL) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
        max: 15,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      const client = await pool.connect();
      console.log("[DB] Conexão com PostgreSQL estabelecida com sucesso.");
      isConnected = true;
      isPostgres = true;

      // Create necessary tables
      await client.query(`
        -- 1. Admin Users
        CREATE TABLE IF NOT EXISTS admin_users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(120) NOT NULL,
          email VARCHAR(180) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          salt VARCHAR(64) NOT NULL,
          role VARCHAR(50) DEFAULT 'admin',
          last_login TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- 2. Site Settings (Meta Pixel, CAPI Token, etc)
        CREATE TABLE IF NOT EXISTS site_settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- 3. Analytics Pageviews
        CREATE TABLE IF NOT EXISTS analytics_pageviews (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(100) NOT NULL,
          visitor_id VARCHAR(100) NOT NULL,
          path VARCHAR(255) DEFAULT '/',
          referrer VARCHAR(500),
          device_type VARCHAR(50),
          browser VARCHAR(80),
          os VARCHAR(80),
          country VARCHAR(10),
          city VARCHAR(100),
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- 4. Analytics Clicks & Heatmap
        CREATE TABLE IF NOT EXISTS analytics_clicks (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(100),
          visitor_id VARCHAR(100),
          event_name VARCHAR(100) NOT NULL,
          button_id VARCHAR(100),
          button_label VARCHAR(255),
          product_name VARCHAR(150),
          product_token VARCHAR(50),
          product_value NUMERIC(10, 2),
          target_url TEXT,
          click_x_pct NUMERIC(5, 2),
          click_y_pct NUMERIC(5, 2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Indexes for speed
        CREATE INDEX IF NOT EXISTS idx_pageviews_created_at ON analytics_pageviews(created_at);
        CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON analytics_clicks(created_at);
        CREATE INDEX IF NOT EXISTS idx_clicks_token ON analytics_clicks(product_token);
      `);

      client.release();
      console.log("[DB] Todas as tabelas verificadas/inicializadas no PostgreSQL.");
    } catch (err) {
      console.error("[DB] Erro ao conectar no PostgreSQL:", err.message);
      isPostgres = false;
      isConnected = false;
    }
  } else {
    console.log("[DB] DATABASE_URL não definida. Utilizando armazenamento local autônomo.");
    isConnected = true;
  }
}

async function query(text, params = []) {
  if (isPostgres && pool) {
    return pool.query(text, params);
  }

  // Emulation for local testing without PostgreSQL
  return executeLocalQuery(text, params);
}

function executeLocalQuery(text, params) {
  const normalized = text.trim().toUpperCase();

  if (normalized.startsWith("SELECT 1")) {
    return { rows: [{ alive: 1 }] };
  }

  // Users emulation
  if (normalized.includes("FROM ADMIN_USERS") || normalized.includes("INTO ADMIN_USERS") || normalized.includes("UPDATE ADMIN_USERS") || normalized.includes("DELETE FROM ADMIN_USERS")) {
    if (normalized.includes("SELECT COUNT(*)")) {
      return { rows: [{ count: localData.users.length.toString() }] };
    }
    if (normalized.startsWith("SELECT * FROM ADMIN_USERS WHERE EMAIL = $1")) {
      const u = localData.users.find(x => x.email.toLowerCase() === params[0].toLowerCase());
      return { rows: u ? [u] : [] };
    }
    if (normalized.startsWith("SELECT * FROM ADMIN_USERS WHERE ID = $1")) {
      const u = localData.users.find(x => x.id === parseInt(params[0], 10));
      return { rows: u ? [u] : [] };
    }
    if (normalized.startsWith("SELECT ID, NAME, EMAIL, ROLE, LAST_LOGIN, CREATED_AT FROM ADMIN_USERS")) {
      let list = localData.users;
      if (normalized.includes("NOT IN ('MASTER', 'SUPERADMIN')") || normalized.includes("ROLE != 'MASTER'")) {
        list = list.filter(u => u.role !== 'master' && u.role !== 'superadmin');
      }
      const sorted = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { rows: sorted.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, last_login: u.last_login, created_at: u.created_at })) };
    }
    if (normalized.startsWith("INSERT INTO ADMIN_USERS")) {
      const newId = localData.users.length ? Math.max(...localData.users.map(u => u.id)) + 1 : 1;
      const user = {
        id: newId,
        name: params[0],
        email: params[1],
        password_hash: params[2],
        salt: params[3],
        role: params[4] || "admin",
        last_login: null,
        created_at: new Date().toISOString(),
      };
      localData.users.push(user);
      saveLocalData();
      return { rows: [user] };
    }
    if (normalized.startsWith("UPDATE ADMIN_USERS SET LAST_LOGIN")) {
      const user = localData.users.find(u => u.id === parseInt(params[1], 10));
      if (user) user.last_login = params[0];
      saveLocalData();
      return { rowCount: 1 };
    }
    if (normalized.startsWith("UPDATE ADMIN_USERS SET NAME = $1, EMAIL = $2")) {
      const user = localData.users.find(u => u.id === parseInt(params[2], 10));
      if (user) {
        user.name = params[0];
        user.email = params[1];
        saveLocalData();
      }
      return { rowCount: 1 };
    }
    if (normalized.startsWith("UPDATE ADMIN_USERS SET PASSWORD_HASH = $1, SALT = $2")) {
      const user = localData.users.find(u => u.id === parseInt(params[2], 10));
      if (user) {
        user.password_hash = params[0];
        user.salt = params[1];
        saveLocalData();
      }
      return { rowCount: 1 };
    }
    if (normalized.startsWith("DELETE FROM ADMIN_USERS")) {
      localData.users = localData.users.filter(u => u.id !== parseInt(params[0], 10));
      saveLocalData();
      return { rowCount: 1 };
    }
  }

  // Settings emulation
  if (normalized.includes("SITE_SETTINGS")) {
    if (normalized.startsWith("SELECT VALUE FROM SITE_SETTINGS WHERE KEY = $1")) {
      const val = localData.settings[params[0]];
      return { rows: val !== undefined ? [{ value: val }] : [] };
    }
    if (normalized.startsWith("SELECT KEY, VALUE FROM SITE_SETTINGS")) {
      const rows = Object.entries(localData.settings).map(([k, v]) => ({ key: k, value: v }));
      return { rows };
    }
    if (normalized.includes("INSERT INTO SITE_SETTINGS")) {
      localData.settings[params[0]] = params[1];
      saveLocalData();
      return { rowCount: 1 };
    }
  }

  // Analytics Pageviews emulation
  if (normalized.includes("ANALYTICS_PAGEVIEWS")) {
    if (normalized.startsWith("INSERT INTO ANALYTICS_PAGEVIEWS")) {
      const pv = {
        id: localData.pageviews.length + 1,
        session_id: params[0],
        visitor_id: params[1],
        path: params[2],
        referrer: params[3],
        device_type: params[4],
        browser: params[5],
        os: params[6],
        country: params[7],
        city: params[8],
        user_agent: params[9],
        created_at: new Date().toISOString(),
      };
      localData.pageviews.push(pv);
      saveLocalData();
      return { rows: [pv] };
    }
  }

  // Analytics Clicks emulation
  if (normalized.includes("ANALYTICS_CLICKS")) {
    if (normalized.startsWith("INSERT INTO ANALYTICS_CLICKS")) {
      const clk = {
        id: localData.clicks.length + 1,
        session_id: params[0],
        visitor_id: params[1],
        event_name: params[2],
        button_id: params[3],
        button_label: params[4],
        product_name: params[5],
        product_token: params[6],
        product_value: parseFloat(params[7]) || 0,
        target_url: params[8],
        click_x_pct: parseFloat(params[9]) || 0,
        click_y_pct: parseFloat(params[10]) || 0,
        created_at: new Date().toISOString(),
      };
      localData.clicks.push(clk);
      saveLocalData();
      return { rows: [clk] };
    }
  }

  return { rows: [], rowCount: 0 };
}

function getLocalData() {
  return localData;
}

module.exports = {
  initDB,
  query,
  get isConnected() {
    return isConnected;
  },
  get isPostgres() {
    return isPostgres;
  },
  getLocalData,
};
