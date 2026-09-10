const express = require("express");
const path = require("path");
const db = require("./lib/db");
const auth = require("./lib/auth");
const meta = require("./lib/meta");
const analytics = require("./lib/analytics");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Anti-cache headers for dynamic/static HTML
app.use((req, res, next) => {
  if (req.path === "/" || req.path.endsWith(".html") || req.path.startsWith("/admin")) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// Static Assets
app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    },
  })
);

// Initialize DB & Seed
(async () => {
  try {
    await db.initDB();
    await auth.seedDefaultAdmin();
  } catch (err) {
    console.error("[SERVER] Erro durante inicialização do banco:", err.message);
  }
})();

// ============================================================================
// HEALTHCHECK ENDPOINTS
// ============================================================================
const healthHandler = async (req, res) => {
  let dbStatus = "not_configured";
  try {
    const check = await db.query("SELECT 1 AS alive");
    dbStatus = check.rows.length ? "connected" : "error";
  } catch (err) {
    dbStatus = "disconnected: " + err.message;
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

// ============================================================================
// PUBLIC TRACKING & CONFIG ENDPOINTS
// ============================================================================

// Return Meta configuration for public landing page
app.get("/api/config/meta", async (req, res) => {
  try {
    const settings = await meta.getMetaSettings();
    return res.json({
      is_active: settings.is_active,
      pixel_id: settings.is_active ? settings.pixel_id : null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Track pageview
app.post("/api/track/pageview", async (req, res) => {
  try {
    const { session_id, visitor_id, path: pagePath, referrer, device_type, browser, os } = req.body;
    const country = req.headers["cf-ipcountry"] || req.headers["x-country"] || "BR";
    const userAgent = req.headers["user-agent"] || "";

    await db.query(
      `INSERT INTO analytics_pageviews (session_id, visitor_id, path, referrer, device_type, browser, os, country, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        session_id || "anon_session",
        visitor_id || "anon_visitor",
        pagePath || "/",
        (referrer || "").slice(0, 500),
        device_type || "Desktop",
        browser || "Outro",
        os || "Outro",
        country,
        userAgent,
      ]
    );

    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Track click & heatmap event (and dispatch Meta CAPI if applicable)
app.post("/api/track/click", async (req, res) => {
  try {
    const {
      session_id,
      visitor_id,
      event_name,
      button_id,
      button_label,
      product_name,
      product_token,
      product_value,
      target_url,
      click_x_pct,
      click_y_pct,
      event_id,
    } = req.body;

    const clientIp = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"] || "";

    // Save click in DB
    await db.query(
      `INSERT INTO analytics_clicks 
       (session_id, visitor_id, event_name, button_id, button_label, product_name, product_token, product_value, target_url, click_x_pct, click_y_pct)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        session_id || "anon_session",
        visitor_id || "anon_visitor",
        event_name || "click",
        button_id || "btn_unknown",
        button_label || "",
        product_name || null,
        product_token || null,
        parseFloat(product_value) || 0,
        target_url || "",
        click_x_pct !== undefined ? parseFloat(click_x_pct) : null,
        click_y_pct !== undefined ? parseFloat(click_y_pct) : null,
      ]
    );

    // Meta CAPI Server-side dispatch for purchase intention or contact
    if (event_name === "initiate_checkout" || event_name === "whatsapp_click") {
      const metaEventName = event_name === "initiate_checkout" ? "InitiateCheckout" : "Contact";
      meta
        .sendMetaEvent({
          eventName: metaEventName,
          eventId: event_id,
          clientIp,
          userAgent,
          sourceUrl: target_url || "https://reinatus.com.br",
          customData: {
            content_name: product_name || "Super Poten Max",
            content_ids: product_token ? [product_token] : [],
            value: parseFloat(product_value) || 0,
            currency: "BRL",
          },
        })
        .catch((e) => console.warn("[META CAPI] Erro ao despachar evento:", e.message));
    }

    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Legacy conversion tracking fallback
app.post("/api/track", async (req, res) => {
  return res.status(200).json({ success: true });
});

// ============================================================================
// ADMIN AUTHENTICATION ENDPOINTS
// ============================================================================

// Admin Login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    const check = await db.query("SELECT * FROM admin_users WHERE email = $1", [email.trim().toLowerCase()]);
    if (check.rows.length === 0) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const user = check.rows[0];
    const isMatch = auth.verifyPassword(password, user.password_hash, user.salt);
    if (!isMatch) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // Update last login
    const now = new Date().toISOString();
    await db.query("UPDATE admin_users SET last_login = $1 WHERE id = $2", [now, user.id]);

    // Create session token
    const token = auth.createToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    res.cookie("reinatus_admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: auth.TOKEN_MAX_AGE_SEC * 1000,
      path: "/",
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Logout
app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("reinatus_admin_token", { path: "/" });
  return res.json({ success: true });
});

// Admin Check Session
app.get("/api/admin/me", auth.requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

// ============================================================================
// ADMIN USER MANAGEMENT ENDPOINTS
// ============================================================================

// List Users
app.get("/api/admin/users", auth.requireAuth, async (req, res) => {
  try {
    const result = await db.query("SELECT id, name, email, role, last_login, created_at FROM admin_users ORDER BY id ASC");
    return res.json({ users: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Create User
app.post("/api/admin/users", auth.requireAuth, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    }

    const check = await db.query("SELECT id FROM admin_users WHERE email = $1", [email.trim().toLowerCase()]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: "Este e-mail já está cadastrado." });
    }

    const { hash, salt } = auth.hashPassword(password);
    const result = await db.query(
      "INSERT INTO admin_users (name, email, password_hash, salt, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, created_at",
      [name.trim(), email.trim().toLowerCase(), hash, salt, role || "admin"]
    );

    return res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Update User (Edit name/email or reset password)
app.put("/api/admin/users/:id", auth.requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { name, email, password } = req.body;

    const check = await db.query("SELECT * FROM admin_users WHERE id = $1", [userId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    if (name && email) {
      await db.query("UPDATE admin_users SET name = $1, email = $2 WHERE id = $3", [name.trim(), email.trim().toLowerCase(), userId]);
    }

    if (password && password.trim().length >= 6) {
      const { hash, salt } = auth.hashPassword(password.trim());
      await db.query("UPDATE admin_users SET password_hash = $1, salt = $2 WHERE id = $3", [hash, salt, userId]);
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete User
app.delete("/api/admin/users/:id", auth.requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (req.user.id === userId) {
      return res.status(400).json({ error: "Você não pode excluir sua própria conta logada." });
    }

    const totalRes = await db.query("SELECT COUNT(*) as count FROM admin_users");
    if (parseInt(totalRes.rows[0].count, 10) <= 1) {
      return res.status(400).json({ error: "Não é possível excluir o único administrador do sistema." });
    }

    await db.query("DELETE FROM admin_users WHERE id = $1", [userId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ADMIN META SETTINGS ENDPOINTS
// ============================================================================

// Get Meta Settings
app.get("/api/admin/settings/meta", auth.requireAuth, async (req, res) => {
  try {
    const settings = await meta.getMetaSettings();
    return res.json(settings);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Save Meta Settings
app.post("/api/admin/settings/meta", auth.requireAuth, async (req, res) => {
  try {
    const { pixel_id, access_token, test_event_code, is_active } = req.body;
    await meta.saveMetaSettings({ pixel_id, access_token, test_event_code, is_active });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Test Meta CAPI Connection
app.post("/api/admin/settings/meta/test", auth.requireAuth, async (req, res) => {
  try {
    const { pixel_id, access_token, test_event_code } = req.body;
    if (!pixel_id || !access_token) {
      return res.status(400).json({ error: "Pixel ID e Access Token são necessários para testar." });
    }

    const clientIp = req.headers["cf-connecting-ip"] || "127.0.0.1";
    const userAgent = req.headers["user-agent"] || "Reinatus-Meta-Tester/1.0";

    const payload = {
      data: [
        {
          event_name: "TestConnectionEvent",
          event_time: Math.floor(Date.now() / 1000),
          event_id: "test_" + Date.now(),
          action_source: "website",
          user_data: {
            client_ip_address: clientIp,
            client_user_agent: userAgent,
          },
          custom_data: {
            status: "ok",
            test: true,
          },
        },
      ],
    };

    if (test_event_code) {
      payload.test_event_code = test_event_code;
    }

    const result = await meta.dispatchToMeta(pixel_id, access_token, payload);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ADMIN ANALYTICS ENDPOINTS
// ============================================================================

// Overview KPIs
app.get("/api/admin/analytics/overview", auth.requireAuth, async (req, res) => {
  try {
    const period = req.query.period || "7d";
    const data = await analytics.getOverview(period);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Product Ranking
app.get("/api/admin/analytics/products", auth.requireAuth, async (req, res) => {
  try {
    const period = req.query.period || "7d";
    const ranking = await analytics.getProductRanking(period);
    return res.json({ ranking });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Heatmap & Click Buttons
app.get("/api/admin/analytics/heatmap", auth.requireAuth, async (req, res) => {
  try {
    const period = req.query.period || "7d";
    const data = await analytics.getHeatmapData(period);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Traffic Stats (Devices & Referrers)
app.get("/api/admin/analytics/traffic", auth.requireAuth, async (req, res) => {
  try {
    const period = req.query.period || "7d";
    const data = await analytics.getTrafficStats(period);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ADMIN ROUTING & FALLBACK
// ============================================================================

// Serve Admin SPA
app.get("/admin*", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "public", "admin", "index.html"));
});

// Fallback to Public Landing Page
app.get("*", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 [REINATUS] Servidor rodando em http://${HOST}:${PORT}`);
});
