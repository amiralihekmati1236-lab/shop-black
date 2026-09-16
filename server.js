const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC = ROOT;

const DATA = path.join(ROOT, "data");
const ORDERS = path.join(DATA, "orders.json");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1236";
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SECRET_KEY = String(process.env.SUPABASE_SECRET_KEY || "");

const sessions = new Set();

fs.mkdirSync(DATA, { recursive: true });

if (!fs.existsSync(ORDERS)) {
  fs.writeFileSync(ORDERS, "[]");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function send(res, status, body, type = "text/html; charset=utf-8", extra = {}) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    ...extra
  });
  res.end(body);
}

function json(res, status, value) {
  send(
    res,
    status,
    JSON.stringify(value),
    "application/json; charset=utf-8"
  );
}

function jsonWithCookie(res, status, value, token) {
  send(
    res,
    status,
    JSON.stringify(value),
    "application/json; charset=utf-8",
    {
      "Set-Cookie":
        shop_session=${token}; HttpOnly; SameSite=Lax; Path=/
    }
  );
}

function cookieSession(req) {
  const c = req.headers.cookie || "";
  const m = c.match(/shop_session=([^;]+)/);
  return m && sessions.has(m[1]) ? m[1] : null;
}

function requireAdmin(req, res) {
  if (!cookieSession(req)) {
    json(res, 401, {
      ok: false,
      error: "دسترسی غیرمجاز"
    });
    return false;
  }

  return true;
}

function parseBody(req, limit = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", chunk => {
      data += chunk;

      if (data.length > limit) {
        reject(new Error("حجم درخواست زیاد است"));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("JSON نامعتبر"));
      }
    });

    req.on("error", reject);
  });
}

function mimeExt(mime) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  };

  return map[mime] || null;
}

function mapProduct(row) {
  return {
    id: String(row.id),
    name: row.name || "",
    price: Number(row.price || 0),
    image: row.image || "",
    description: row.description || "",
    createdAt: row.created_at || ""
  };
}

function supabaseHeaders(extra = {}) {
  return {
    "apikey": SUPABASE_SECRET_KEY,
    "Authorization": Bearer ${SUPABASE_SECRET_KEY},
    "Content-Type": "application/json",
    ...extra
  };
}

async function supabaseRequest(endpoint, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error("تنظیمات Supabase در Render کامل نیست");
  }

  const response = await fetch(
    ${SUPABASE_URL}${endpoint},
    {
      ...options,
      headers: {
        ...supabaseHeaders(),
        ...(options.headers || {})
      }
    }
  );

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }async function createProduct(product) {
  const data = await supabaseRequest(
    "/rest/v1/products",
    {
      method: "POST",
      headers: {
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        name: product.name,
        price: product.price,
        image: product.image,
        description: product.description
      })
    }
  );

  return mapProduct(data[0]);
}

async function updateProduct(id, product) {
  const data = await supabaseRequest(
    /rest/v1/products?id=eq.${encodeURIComponent(id)},
    {
      method: "PATCH",
      headers: {
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        name: product.name,
        price: product.price,
        image: product.image,
        description: product.description
      })
    }
  );

  if (!data.length) {
    throw new Error("محصول پیدا نشد");
  }

  return mapProduct(data[0]);
}

async function deleteProduct(id) {
  await supabaseRequest(
    /rest/v1/products?id=eq.${encodeURIComponent(id)},
    {
      method: "DELETE"
    }
  );
}

async function ensureStorageBucket() {
  try {
    await supabaseRequest(
      "/storage/v1/bucket",
      {
        method: "POST",
        body: JSON.stringify({
          id: "product-images",
          name: "product-images",
          public: true
        })
      }
    );
  } catch (e) {
    // اگر bucket از قبل وجود داشته باشد، مشکلی نیست.
  }
}

async function uploadImage(filename, mime, buffer) {
  await ensureStorageBucket();

  const response = await fetch(
    ${SUPABASE_URL}/storage/v1/object/product-images/${encodeURIComponent(filename)},
    {
      method: "POST",
      headers: {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": Bearer ${SUPABASE_SECRET_KEY},
        "Content-Type": mime,
        "x-upsert": "true"
      },
      body: buffer
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "آپلود عکس ناموفق بود");
  }

  return ${SUPABASE_URL}/storage/v1/object/public/product-images/${filename};
}

async function deleteImage(url) {
  if (!url || !url.includes("/storage/v1/object/public/product-images/")) {
    return;
  }

  const marker = "/storage/v1/object/public/product-images/";
  const filename = decodeURIComponent(url.split(marker)[1] || "");

  if (!filename) return;

  try {
    await supabaseRequest(
      "/storage/v1/object/product-images",
      {
        method: "DELETE",
        body: JSON.stringify({
          prefixes: [filename]
        })
      }
    );
  } catch (e) {
    console.error("Image delete error:", e.message);
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(
    req.url,
    http://${req.headers.host || "localhost"}
  );

  const p = u.pathname;

  try {

    // =========================
    // PRODUCTS
    // =========================

    if (p === "/api/products" && req.method === "GET") {
      const products = await getProducts();
      return json(res, 200, products);
    }

    // =========================
    // ADMIN LOGIN
    // =========================

    if (p === "/api/admin/login" && req.method === "POST") {
      const body = await parseBody(req, 100000);

      if (String(body.password || "") !== ADMIN_PASSWORD) {
        return json(res, 401, {
          ok: false,
          error: "رمز عبور اشتباه است"
        });
      }

      const token = crypto.randomBytes(32).toString("hex");

      sessions.add(token);

      return jsonWithCookie(
        res,
        200,
        { ok: true },
        token
      );
    }
if (p === "/api/admin/products" && req.method === "POST") {
      if (!requireAdmin(req, res)) return;

      const body = await parseBody(req);

      const name = String(body.name || "").trim();
      const price = Number(body.price);
      const description = String(body.description || "").trim();
      const image = String(body.image || "").trim();

      if (
        !name ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        return json(res, 400, {
          ok: false,
          error: "نام و قیمت معتبر وارد کنید"
        });
      }

      const product = await createProduct({
        name,
        price: Math.round(price),
        description,
        image
      });

      return json(res, 201, {
        ok: true,
        product
      });
    }

    // =========================
    // EDIT PRODUCT
    // =========================

    if (
      p.startsWith("/api/admin/products/") &&
      req.method === "PUT"
    ) {
      if (!requireAdmin(req, res)) return;

      const pid = p.split("/").pop();

      const body = await parseBody(req);

      const products = await getProducts();

      const oldProduct = products.find(
        x => x.id === pid
      );

      if (!oldProduct) {
        return json(res, 404, {
          ok: false,
          error: "محصول پیدا نشد"
        });
      }

      const name = String(
        body.name ?? oldProduct.name
      ).trim();

      const price = Number(
        body.price ?? oldProduct.price
      );

      const description = String(
        body.description ?? oldProduct.description
      ).trim();

      const image = String(
        body.image ?? oldProduct.image
      ).trim();

      if (
        !name ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        return json(res, 400, {
          ok: false,
          error: "اطلاعات محصول نامعتبر است"
        });
      }

      const product = await updateProduct(pid, {
        name,
        price: Math.round(price),
        description,
        image
      });

      return json(res, 200, {
        ok: true,
        product
      });
    }

    // =========================
    // DELETE PRODUCT
    // =========================

    if (
      p.startsWith("/api/admin/products/") &&
      req.method === "DELETE"
    ) {
      if (!requireAdmin(req, res)) return;

      const pid = p.split("/").pop();

      const products = await getProducts();

      const item = products.find(
        x => x.id === pid
      );

      if (!item) {
        return json(res, 404, {
          ok: false,
          error: "محصول پیدا نشد"
        });
      }

      await deleteProduct(pid);

      await deleteImage(item.image);

      return json(res, 200, {
        ok: true
      });
    }

    // =========================
    // IMAGE UPLOAD
    // =========================

    if (
      p === "/api/admin/upload" &&
      req.method === "POST"
    ) {
      if (!requireAdmin(req, res)) return;

      const body = await parseBody(
        req,
        15 * 1024 * 1024
      );

      const mime = String(body.mime || "");

      const ext = mimeExt(mime);

      if (!ext || !body.data) {
        return json(res, 400, {
          ok: false,
          error:
            "فقط JPG، PNG، WEBP یا GIF مجاز است"
        });
      }

      const raw = String(body.data).replace(
        /^data:[^;]+;base64,/,
        ""
      );

      const buffer = Buffer.from(
        raw,
        "base64"
      );

      if (buffer.length > 8 * 1024 * 1024) {
        return json(res, 400, {
          ok: false,
          error:
            "حجم عکس باید کمتر از ۸ مگابایت باشد"
        });
      }

      const filename =
        ${Date.now()}-${cryptoif (
      p === "/api/orders" &&
      req.method === "POST"
    ) {
      const body = await parseBody(
        req,
        500000
      );

      const items = Array.isArray(body.items)
        ? body.items
        : [];

      if (!items.length) {
        return json(res, 400, {
          ok: false,
          error: "سبد خرید خالی است"
        });
      }

      const products = await getProducts();

      const clean = [];

      let total = 0;

      for (const x of items) {
        const pr = products.find(
          y => y.id === String(x.id)
        );

        const qty = Math.max(
          1,
          Math.min(
            99,
            Number(x.qty) || 1
          )
        );

        if (!pr) continue;

        clean.push({
          id: pr.id,
          name: pr.name,
          price: pr.price,
          qty
        });

        total += pr.price * qty;
      }

      if (!clean.length) {
        return json(res, 400, {
          ok: false,
          error:
            "محصولات سفارش پیدا نشدند"
        });
      }

      const order = {
        id: crypto.randomUUID(),
        items: clean,
        total,
        customer: {
          name: String(
            body.customer?.name || ""
          ).trim(),

          phone: String(
            body.customer?.phone || ""
          ).trim()
        },

        status: "در انتظار پرداخت",

        createdAt:
          new Date().toISOString()
      };

      const orders = readJson(ORDERS);

      orders.unshift(order);

      writeJson(
        ORDERS,
        orders
      );

      return json(res, 201, {
        ok: true,
        order
      });
    }

    // =========================
    // ADMIN ORDERS
    // =========================

    if (
      p === "/api/admin/orders" &&
      req.method === "GET"
    ) {
      if (!requireAdmin(req, res)) return;

      return json(
        res,
        200,
        readJson(ORDERS)
      );
    }

    // =========================
    // ADMIN PAGE
    // =========================

    if (p === "/admin") {
      return send(
        res,
        200,
        fs.readFileSync(
          path.join(
            PUBLIC,
            "admin.html"
          ),
          "utf8"
        )
      );
    }

    // =========================
    // STATIC FILES
    // =========================

    let file =
      p === "/"
        ? "/index.html"
        : p;

    file = path
      .normalize(file)
      .replace(
        /^(\.\.[\/\\])+/,
        ""
      );

    const full = path.join(
      PUBLIC,
      file
    );

    if (
      !full.startsWith(PUBLIC) ||
      !fs.existsSync(full) ||
      fs.statSync(full).isDirectory()
    ) {
      return send(
        res,
        404,
        "صفحه پیدا نشد",
        "text/plain; charset=utf-8"
      );
    }

    const ext =
      path.extname(full)
        .toLowerCase();

    const types = {
      ".html":
        "text/html; charset=utf-8",

      ".css":
        "text/css; charset=utf-8",

      ".js":
        "text/javascript; charset=utf-8",

      ".json":
        "application/json; charset=utf-8",

      ".svg":
        "image/svg+xml",

      ".png":
        "image/png",

      ".jpg":
        "image/jpeg",

      ".jpeg":
        "image/jpeg",

      ".webp":
        "image/webp",

      ".gif":
        "image/gif"
    };

    return send(
      res,
      200,
      fs.readFileSync(full),
      types[ext] ||
        "application/octet-stream"
    );

  } catch (e) {
    console.error(e);

    return json(
      res,
      500,
      {
        ok: false,
        error:
          e.message ||
          "خطای سرور"
      }
    );
  }
});

server.listen(
  PORT,
  () => {
    console.log(
      SHOP BLACK: http://localhost:${PORT}
    );
  }
);
          .randomBytes(5)
          .toString("hex")}.${ext};

      const url = await uploadImage(
        filename,
        mime,
        buffer
      );

      return json(res, 201, {
        ok: true,
        url
      });
    }

    // =========================
    // ORDERS
    // =========================
    if (p === "/api/admin/logout" && req.method === "POST") {
      const s = cookieSession(req);

      if (s) {
        sessions.delete(s);
      }

      return json(res, 200, { ok: true });
    }

    if (p === "/api/admin/me" && req.method === "GET") {
      return json(res, 200, {
        loggedIn: !!cookieSession(req)
      });
    }

    // =========================
    // ADD PRODUCT
    // =========================

  if (!response.ok) {
    const message =
      typeof data === "object" && data
        ? data.message ⠞⠵⠟⠵⠵⠟⠞⠟⠺⠺⠟⠵ JSON.stringify(data)
        : String(data || response.statusText);

    throw new Error(message);
  }

  return data;
}

async function getProducts() {
  const data = await supabaseRequest(
    "/rest/v1/products?select=*&order=created_at.desc"
  );

  return Array.isArray(data) ? data.map(mapProduct) : [];
}
