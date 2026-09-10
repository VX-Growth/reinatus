const https = require("https");
const db = require("./db");

async function getMetaSettings() {
  try {
    const res = await db.query("SELECT key, value FROM site_settings WHERE key LIKE 'meta_%'");
    const settings = {
      pixel_id: "",
      access_token: "",
      test_event_code: "",
      is_active: false,
    };
    res.rows.forEach((row) => {
      if (row.key === "meta_pixel_id") settings.pixel_id = row.value || "";
      if (row.key === "meta_access_token") settings.access_token = row.value || "";
      if (row.key === "meta_test_event_code") settings.test_event_code = row.value || "";
      if (row.key === "meta_is_active") settings.is_active = row.value === "true";
    });
    return settings;
  } catch (err) {
    return { pixel_id: "", access_token: "", test_event_code: "", is_active: false };
  }
}

async function saveMetaSettings({ pixel_id, access_token, test_event_code, is_active }) {
  const pairs = [
    ["meta_pixel_id", (pixel_id || "").trim()],
    ["meta_access_token", (access_token || "").trim()],
    ["meta_test_event_code", (test_event_code || "").trim()],
    ["meta_is_active", is_active ? "true" : "false"],
  ];

  for (const [key, val] of pairs) {
    if (db.isPostgres) {
      await db.query(
        "INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP",
        [key, val]
      );
    } else {
      await db.query("INSERT INTO site_settings (key, value) VALUES ($1, $2)", [key, val]);
    }
  }
}

function dispatchToMeta(pixelId, accessToken, payload) {
  return new Promise((resolve) => {
    const dataString = JSON.stringify(payload);
    const options = {
      hostname: "graph.facebook.com",
      port: 443,
      path: `/v19.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(dataString),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, status: res.statusCode, data: parsed });
          } else {
            resolve({ success: false, status: res.statusCode, error: parsed.error?.message || body });
          }
        } catch (e) {
          resolve({ success: false, status: res.statusCode, error: body });
        }
      });
    });

    req.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });

    req.setTimeout(8000, () => {
      req.destroy();
      resolve({ success: false, error: "Meta API Timeout (8s)" });
    });

    req.write(dataString);
    req.end();
  });
}

async function sendMetaEvent({ eventName, eventId, eventTime, clientIp, userAgent, sourceUrl, customData = {} }) {
  const settings = await getMetaSettings();
  if (!settings.is_active || !settings.pixel_id || !settings.access_token) {
    return { skipped: true, reason: "Meta CAPI não configurado ou inativo." };
  }

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime || Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: sourceUrl || "https://reinatus.com.br",
        action_source: "website",
        user_data: {
          client_ip_address: clientIp,
          client_user_agent: userAgent,
        },
        custom_data: customData,
      },
    ],
  };

  if (settings.test_event_code) {
    payload.test_event_code = settings.test_event_code;
  }

  return dispatchToMeta(settings.pixel_id, settings.access_token, payload);
}

module.exports = {
  getMetaSettings,
  saveMetaSettings,
  sendMetaEvent,
  dispatchToMeta,
};
