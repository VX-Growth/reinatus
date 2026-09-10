const crypto = require("crypto");
const db = require("./db");

const JWT_SECRET = process.env.ADMIN_SECRET || "reinatus-master-secret-key-2026";
const TOKEN_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString("hex");
  }
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, storedHash, salt) {
  try {
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
  } catch (err) {
    return false;
  }
}

function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + TOKEN_MAX_AGE_SEC;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  try {
    const sigValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    if (!sigValid) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(";").forEach((cookie) => {
    let [name, ...rest] = cookie.split("=");
    name = name.trim();
    if (!name) return;
    const value = rest.join("=").trim();
    if (!value) return;
    list[name] = decodeURIComponent(value);
  });
  return list;
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req);
  let token = cookies.reinatus_admin_token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      token = parts[1];
    }
  }

  const user = verifyToken(token);
  if (!user) {
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "Sessão expirada ou não autenticado." });
    }
    return res.redirect("/admin/login");
  }

  req.user = user;
  next();
}

async function seedDefaultAdmin() {
  try {
    const check = await db.query("SELECT COUNT(*) FROM admin_users");
    const count = parseInt(check.rows[0].count, 10);
    if (count === 0) {
      const defaultEmail = process.env.ADMIN_DEFAULT_EMAIL || "admin@reinatus.com.br";
      const defaultPass = process.env.ADMIN_DEFAULT_PASS || "Reinatus@2026!";
      const { hash, salt } = hashPassword(defaultPass);

      await db.query(
        "INSERT INTO admin_users (name, email, password_hash, salt, role) VALUES ($1, $2, $3, $4, $5)",
        ["Administrador Principal", defaultEmail, hash, salt, "superadmin"]
      );
      console.log(`[AUTH] Administrador padrão inicial criado: ${defaultEmail}`);
    }
  } catch (err) {
    console.warn("[AUTH] Erro ao verificar/criar administrador padrão:", err.message);
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  parseCookies,
  requireAuth,
  seedDefaultAdmin,
  TOKEN_MAX_AGE_SEC,
};
