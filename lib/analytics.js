const db = require("./db");

function getDateCondition(period, tableAlias = "") {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  const now = new Date();

  if (period === "today") {
    return {
      sql: `${prefix}created_at >= CURRENT_DATE`,
      filterFn: (row) => {
        const d = new Date(row.created_at);
        return d.toDateString() === now.toDateString();
      },
    };
  }

  if (period === "yesterday") {
    const y = new Date();
    y.setDate(now.getDate() - 1);
    return {
      sql: `${prefix}created_at >= CURRENT_DATE - INTERVAL '1 day' AND ${prefix}created_at < CURRENT_DATE`,
      filterFn: (row) => {
        const d = new Date(row.created_at);
        return d.toDateString() === y.toDateString();
      },
    };
  }

  if (period === "7d") {
    const limit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      sql: `${prefix}created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'`,
      filterFn: (row) => new Date(row.created_at) >= limit,
    };
  }

  if (period === "30d") {
    const limit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      sql: `${prefix}created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'`,
      filterFn: (row) => new Date(row.created_at) >= limit,
    };
  }

  // 'all' or default
  return {
    sql: "1=1",
    filterFn: () => true,
  };
}

async function getOverview(period = "7d") {
  const dateCond = getDateCondition(period);

  if (!db.isPostgres) {
    const localData = db.getLocalData();
    const pvs = localData.pageviews.filter(dateCond.filterFn);
    const clks = localData.clicks.filter(dateCond.filterFn);

    const uniqueVisitors = new Set(pvs.map((p) => p.visitor_id)).size;
    const checkoutClicks = clks.filter((c) => c.event_name === "initiate_checkout");
    const totalCheckoutValue = checkoutClicks.reduce((sum, c) => sum + (c.product_value || 0), 0);
    const conversionRate = uniqueVisitors > 0 ? ((checkoutClicks.length / uniqueVisitors) * 100).toFixed(1) : "0.0";
    const waClicks = clks.filter((c) => c.event_name === "whatsapp_click").length;

    return {
      period,
      pageviews: pvs.length,
      uniqueVisitors,
      totalClicks: clks.length,
      checkoutClicks: checkoutClicks.length,
      totalCheckoutValue: parseFloat(totalCheckoutValue.toFixed(2)),
      conversionRate: parseFloat(conversionRate),
      whatsappClicks: waClicks,
    };
  }

  try {
    const pvRes = await db.query(`
      SELECT 
        COUNT(*) as total_pageviews,
        COUNT(DISTINCT visitor_id) as unique_visitors
      FROM analytics_pageviews
      WHERE ${dateCond.sql}
    `);

    const clkRes = await db.query(`
      SELECT 
        COUNT(*) as total_clicks,
        COUNT(CASE WHEN event_name = 'initiate_checkout' THEN 1 END) as checkout_clicks,
        COALESCE(SUM(CASE WHEN event_name = 'initiate_checkout' THEN product_value ELSE 0 END), 0) as total_checkout_value,
        COUNT(CASE WHEN event_name = 'whatsapp_click' THEN 1 END) as whatsapp_clicks
      FROM analytics_clicks
      WHERE ${dateCond.sql}
    `);

    const pvRow = pvRes.rows[0] || {};
    const clkRow = clkRes.rows[0] || {};

    const pageviews = parseInt(pvRow.total_pageviews || 0, 10);
    const uniqueVisitors = parseInt(pvRow.unique_visitors || 0, 10);
    const totalClicks = parseInt(clkRow.total_clicks || 0, 10);
    const checkoutClicks = parseInt(clkRow.checkout_clicks || 0, 10);
    const totalCheckoutValue = parseFloat(clkRow.total_checkout_value || 0);
    const whatsappClicks = parseInt(clkRow.whatsapp_clicks || 0, 10);

    const conversionRate = uniqueVisitors > 0 ? ((checkoutClicks / uniqueVisitors) * 100).toFixed(1) : "0.0";

    return {
      period,
      pageviews,
      uniqueVisitors,
      totalClicks,
      checkoutClicks,
      totalCheckoutValue,
      conversionRate: parseFloat(conversionRate),
      whatsappClicks,
    };
  } catch (err) {
    console.error("[ANALYTICS] Erro no overview:", err.message);
    return {
      period,
      pageviews: 0,
      uniqueVisitors: 0,
      totalClicks: 0,
      checkoutClicks: 0,
      totalCheckoutValue: 0,
      conversionRate: 0,
      whatsappClicks: 0,
    };
  }
}

async function getProductRanking(period = "7d") {
  const dateCond = getDateCondition(period);

  const productMeta = {
    RU4AS8ZODH: { name: "Combo com 2 Kits (Mais Vendido)", price: 497.90, img: "assets/images/kit-combo-2-bestseller.webp" },
    R87V22IOLZ: { name: "Combo com 3 Kits", price: 799.90, img: "assets/images/kit-combo-3.webp" },
    PUQRGLLLWG: { name: "Combo com 1 Kit", price: 297.90, img: "assets/images/kit-combo-1.webp" },
    NG8VJ7MOUR: { name: "Combo com 6 Kits", price: 1499.90, img: "assets/images/kit-combo-6.webp" },
    LF6N2UOMNC: { name: "Líquido 30ml (Gotas)", price: 149.90, img: "assets/images/kit-1-gotas.webp" },
    SXXCXKZDKF: { name: "30 Cápsulas 500mg", price: 199.90, img: "assets/images/kit-2-capsulas.webp" },
    N58J4NCMQ4: { name: "Amostra Grátis (5 Cápsulas)", price: 49.90, img: "assets/images/hero-sample-promo.png" },
  };

  if (!db.isPostgres) {
    const localData = db.getLocalData();
    const clks = localData.clicks
      .filter(dateCond.filterFn)
      .filter((c) => c.event_name === "initiate_checkout" && c.product_token);

    const counts = {};
    Object.keys(productMeta).forEach((token) => {
      counts[token] = { token, clicks: 0, totalValue: 0 };
    });

    clks.forEach((c) => {
      const t = c.product_token;
      if (!counts[t]) {
        counts[t] = { token: t, clicks: 0, totalValue: 0 };
      }
      counts[t].clicks += 1;
      counts[t].totalValue += c.product_value || (productMeta[t] ? productMeta[t].price : 0);
    });

    const totalCheckoutClicks = clks.length;

    const ranking = Object.values(counts)
      .map((item) => {
        const meta = productMeta[item.token] || { name: item.token, price: 0, img: "" };
        const share = totalCheckoutClicks > 0 ? ((item.clicks / totalCheckoutClicks) * 100).toFixed(1) : "0.0";
        return {
          token: item.token,
          name: meta.name,
          price: meta.price,
          img: meta.img,
          clicks: item.clicks,
          share: parseFloat(share),
          totalValue: parseFloat(item.totalValue.toFixed(2)),
        };
      })
      .sort((a, b) => b.clicks - a.clicks);

    return ranking;
  }

  try {
    const res = await db.query(`
      SELECT 
        product_token as token,
        COUNT(*) as clicks,
        COALESCE(SUM(product_value), 0) as total_value
      FROM analytics_clicks
      WHERE event_name = 'initiate_checkout' 
        AND product_token IS NOT NULL
        AND ${dateCond.sql}
      GROUP BY product_token
      ORDER BY clicks DESC
    `);

    const dbMap = {};
    res.rows.forEach((r) => {
      dbMap[r.token] = {
        clicks: parseInt(r.clicks, 10),
        totalValue: parseFloat(r.total_value),
      };
    });

    const totalClicks = res.rows.reduce((sum, r) => sum + parseInt(r.clicks, 10), 0);

    const ranking = Object.entries(productMeta).map(([token, meta]) => {
      const data = dbMap[token] || { clicks: 0, totalValue: 0 };
      const share = totalClicks > 0 ? ((data.clicks / totalClicks) * 100).toFixed(1) : "0.0";
      return {
        token,
        name: meta.name,
        price: meta.price,
        img: meta.img,
        clicks: data.clicks,
        share: parseFloat(share),
        totalValue: data.totalValue,
      };
    }).sort((a, b) => b.clicks - a.clicks);

    return ranking;
  } catch (err) {
    console.error("[ANALYTICS] Erro no ranking de produtos:", err.message);
    return [];
  }
}

async function getHeatmapData(period = "7d") {
  const dateCond = getDateCondition(period);

  if (!db.isPostgres) {
    const localData = db.getLocalData();
    const clks = localData.clicks.filter(dateCond.filterFn);

    const buttonMap = {};
    const points = [];

    clks.forEach((c) => {
      const key = c.button_id || c.button_label || "desconhecido";
      if (!buttonMap[key]) {
        buttonMap[key] = {
          button_id: c.button_id || "",
          button_label: c.button_label || key,
          event_name: c.event_name,
          product_name: c.product_name,
          clicks: 0,
        };
      }
      buttonMap[key].clicks += 1;

      if (c.click_x_pct && c.click_y_pct) {
        points.push({
          x: c.click_x_pct,
          y: c.click_y_pct,
          btn: c.button_id,
        });
      }
    });

    const buttons = Object.values(buttonMap).sort((a, b) => b.clicks - a.clicks);
    return { buttons, points: points.slice(0, 300) };
  }

  try {
    const btnRes = await db.query(`
      SELECT 
        button_id,
        button_label,
        event_name,
        product_name,
        COUNT(*) as clicks
      FROM analytics_clicks
      WHERE ${dateCond.sql}
      GROUP BY button_id, button_label, event_name, product_name
      ORDER BY clicks DESC
      LIMIT 50
    `);

    const ptsRes = await db.query(`
      SELECT 
        click_x_pct as x,
        click_y_pct as y,
        button_id as btn
      FROM analytics_clicks
      WHERE click_x_pct IS NOT NULL 
        AND click_y_pct IS NOT NULL 
        AND ${dateCond.sql}
      ORDER BY id DESC
      LIMIT 300
    `);

    return {
      buttons: btnRes.rows.map((r) => ({
        button_id: r.button_id,
        button_label: r.button_label,
        event_name: r.event_name,
        product_name: r.product_name,
        clicks: parseInt(r.clicks, 10),
      })),
      points: ptsRes.rows.map((r) => ({
        x: parseFloat(r.x),
        y: parseFloat(r.y),
        btn: r.btn,
      })),
    };
  } catch (err) {
    console.error("[ANALYTICS] Erro no mapa de calor:", err.message);
    return { buttons: [], points: [] };
  }
}

async function getTrafficStats(period = "7d") {
  const dateCond = getDateCondition(period);

  if (!db.isPostgres) {
    const localData = db.getLocalData();
    const pvs = localData.pageviews.filter(dateCond.filterFn);

    const devices = { Mobile: 0, Desktop: 0, Tablet: 0 };
    const referrers = {};

    pvs.forEach((p) => {
      const dev = p.device_type || "Desktop";
      devices[dev] = (devices[dev] || 0) + 1;

      let ref = p.referrer || "Direto / Orgânico";
      try {
        if (ref.startsWith("http")) ref = new URL(ref).hostname;
      } catch (e) {}
      referrers[ref] = (referrers[ref] || 0) + 1;
    });

    return {
      devices,
      topReferrers: Object.entries(referrers)
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    };
  }

  try {
    const devRes = await db.query(`
      SELECT 
        COALESCE(device_type, 'Desktop') as device,
        COUNT(*) as count
      FROM analytics_pageviews
      WHERE ${dateCond.sql}
      GROUP BY device_type
    `);

    const refRes = await db.query(`
      SELECT 
        COALESCE(NULLIF(referrer, ''), 'Direto / Orgânico') as referrer,
        COUNT(*) as count
      FROM analytics_pageviews
      WHERE ${dateCond.sql}
      GROUP BY referrer
      ORDER BY count DESC
      LIMIT 8
    `);

    const devices = { Mobile: 0, Desktop: 0, Tablet: 0 };
    devRes.rows.forEach((r) => {
      devices[r.device] = parseInt(r.count, 10);
    });

    return {
      devices,
      topReferrers: refRes.rows.map((r) => {
        let domain = r.referrer;
        try {
          if (domain.startsWith("http")) domain = new URL(domain).hostname;
        } catch (e) {}
        return { domain, count: parseInt(r.count, 10) };
      }),
    };
  } catch (err) {
    console.error("[ANALYTICS] Erro nas estatísticas de tráfego:", err.message);
    return { devices: { Mobile: 0, Desktop: 0, Tablet: 0 }, topReferrers: [] };
  }
}

// ============================================================================
// REAL-TIME PRESENCE & LIVE USERS ENGINE
// ============================================================================
const presenceMemoryMap = new Map();
const recentActivityFeed = [];

function recordPresence({ visitor_id, session_id, path = "/", device_type = "Desktop", country = "BR", activity = null }) {
  if (!visitor_id) return;
  const now = Date.now();

  presenceMemoryMap.set(visitor_id, {
    visitor_id,
    session_id: session_id || "anon",
    path: path || "/",
    device_type: device_type || "Desktop",
    country: country || "BR",
    last_seen: now,
  });

  // Record in live activity feed if an activity event is provided
  if (activity) {
    recentActivityFeed.unshift({
      id: "act_" + Math.random().toString(36).substring(2, 9),
      type: activity.type || "pageview",
      text: activity.text,
      device_type: device_type || "Desktop",
      timestamp: now,
    });
    if (recentActivityFeed.length > 20) {
      recentActivityFeed.pop();
    }
  }

  // Periodic cleanup of in-memory stale entries (> 6 min)
  if (presenceMemoryMap.size > 2000) {
    const staleThreshold = now - 6 * 60 * 1000;
    for (const [vId, val] of presenceMemoryMap.entries()) {
      if (val.last_seen < staleThreshold) presenceMemoryMap.delete(vId);
    }
  }

  // Asynchronous upsert to PostgreSQL presence table
  if (db.isPostgres) {
    db.query(
      `INSERT INTO analytics_presence (visitor_id, session_id, path, device_type, country, last_seen)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (visitor_id) DO UPDATE
       SET session_id = EXCLUDED.session_id,
           path = EXCLUDED.path,
           device_type = EXCLUDED.device_type,
           country = EXCLUDED.country,
           last_seen = CURRENT_TIMESTAMP`,
      [visitor_id, session_id || "anon", path || "/", device_type || "Desktop", country || "BR"]
    ).catch(() => {});
  }
}

async function getRealtimeOnlineUsers() {
  const now = Date.now();
  const windowMs = 3 * 60 * 1000; // 3 minutes window
  const activeThreshold = now - windowMs;

  // Clean memory map
  const activeMemoryVisitors = [];
  for (const [vId, val] of presenceMemoryMap.entries()) {
    if (val.last_seen >= activeThreshold) {
      activeMemoryVisitors.push(val);
    } else if (val.last_seen < now - 10 * 60 * 1000) {
      presenceMemoryMap.delete(vId);
    }
  }

  let onlineCount = activeMemoryVisitors.length;
  let activeSessions = new Set(activeMemoryVisitors.map((v) => v.session_id)).size;
  let mobileCount = activeMemoryVisitors.filter((v) => v.device_type === "Mobile").length;
  let desktopCount = activeMemoryVisitors.filter((v) => v.device_type === "Desktop").length;
  let tabletCount = activeMemoryVisitors.filter((v) => v.device_type === "Tablet").length;

  if (db.isPostgres) {
    try {
      const res = await db.query(`
        SELECT 
          COUNT(DISTINCT visitor_id) as online_users,
          COUNT(DISTINCT session_id) as active_sessions,
          COUNT(CASE WHEN device_type = 'Mobile' THEN 1 END) as mobile_count,
          COUNT(CASE WHEN device_type = 'Desktop' THEN 1 END) as desktop_count,
          COUNT(CASE WHEN device_type NOT IN ('Mobile', 'Desktop') THEN 1 END) as tablet_count
        FROM analytics_presence
        WHERE last_seen >= CURRENT_TIMESTAMP - INTERVAL '3 minutes'
      `);

      if (res.rows.length > 0) {
        const row = res.rows[0];
        const dbOnline = parseInt(row.online_users || 0, 10);
        if (dbOnline > onlineCount) {
          onlineCount = dbOnline;
          activeSessions = parseInt(row.active_sessions || 0, 10);
          mobileCount = parseInt(row.mobile_count || 0, 10);
          desktopCount = parseInt(row.desktop_count || 0, 10);
          tabletCount = parseInt(row.tablet_count || 0, 10);
        }
      }
    } catch (err) {
      // Fallback to memory
    }
  }

  const totalDev = (mobileCount + desktopCount + tabletCount) || (onlineCount || 1);
  const mobilePct = Math.round((mobileCount / totalDev) * 100);
  const desktopPct = Math.round((desktopCount / totalDev) * 100);
  const tabletPct = 100 - (mobilePct + desktopPct);

  const activities = [...recentActivityFeed];

  return {
    onlineUsers: onlineCount,
    activeSessions: activeSessions || onlineCount,
    windowMinutes: 3,
    devices: {
      mobileCount,
      desktopCount,
      tabletCount,
      mobilePct,
      desktopPct,
      tabletPct: tabletPct > 0 ? tabletPct : 0,
    },
    recentActivities: activities.slice(0, 8),
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  getOverview,
  getProductRanking,
  getHeatmapData,
  getTrafficStats,
  recordPresence,
  getRealtimeOnlineUsers,
};
