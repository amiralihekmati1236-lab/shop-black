const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC = ROOT;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1236";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SECRET_KEY = String(process.env.SUPABASE_SECRET_KEY || "");

const UPLOADS = path.join(ROOT, "uploads");
const ORDERS = path.join(ROOT, "orders.json");

const sessions = new Set();

if (!fs.existsSync(UPLOADS)) {
  fs.mkdirSync(UPLOADS, { recursive: true });
}

if (!fs.existsSync(ORDERS)) {
  fs.writeFileSync(ORDERS, "[]", "utf8");
}

function json(res, status, data) {
  const body = JSON.stringify(data);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  res.end(body);
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

function getCookies(req) {
  const cookies = {};
  const raw = req.headers.cookie || "";

  raw.split(";").forEach(part => {
    const index = part.indexOf("=");

    if (index === -1) return;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    cookies[key] = decodeURIComponent(value);
  });

  return cookies;
}

function isAdmin(req) {
  const cookies = getCookies(req);
  return !!cookies.admin_session && sessions.has(cookies.admin_session);
}

function requireAdmin(req, res) {
  if (!isAdmin(req)) {
    json(res, 401, {
      ok: false,
      error: "Unauthorized"
    });

    return false;
  }

  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", chunk => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}

function readJsonBody(req) {
  return readBody(req).then(buffer => {
    if (!buffer.length) return {};

    try {
      return JSON.parse(buffer.toString("utf8"));
    } catch {
      return {};
    }
  });
}

function mapProduct(row) {
  return {
    id: String(row.id),
    name: row.name || "",
    price: Number(row.price || 0),
    image: row.image || "",
    description: row.description || "",
    createdAt: row.created_at || null
  };
}

async function supabaseRequest(endpoint, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error("Supabase environment variables are missing");
  }

  const headers = {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: Bearer ${SUPABASE_SECRET_KEY},
    ...options.headers
  };

  const response = await fetch(
    ${SUPABASE_URL}${endpoint},
    {
      ...options,
      headers
    }
  );

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === "string"
        ? data
        : data?.message ⠟⠟⠞⠺⠞⠵⠟⠞⠟⠞⠞⠺⠟ "Supabase error";

    throw new Error(message);
  }

  return data;
}

async function getProducts() {
  const rows = await supabaseRequest(
    "/rest/v1/products?select=*&order=created_at.desc"
  );

  return rows.map(mapProduct);
}

async function createProduct(product) {
  const rows = await supabaseRequest(
    "/rest/v1/products",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        name: product.name,
        price: product.price,
        image: product.image || "",
        description: product.description || ""
      })
    }
  );

  return mapProduct(rows[0]);
}const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC = ROOT;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1236";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SECRET_KEY = String(process.env.SUPABASE_SECRET_KEY || "");

const UPLOADS = path.join(ROOT, "uploads");
const ORDERS = path.join(ROOT, "orders.json");

const sessions = new Set();

if (!fs.existsSync(UPLOADS)) {
  fs.mkdirSync(UPLOADS, { recursive: true });
}

if (!fs.existsSync(ORDERS)) {
  fs.writeFileSync(ORDERS, "[]", "utf8");
}

function json(res, status, data) {
  const body = JSON.stringify(data);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  res.end(body);
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

function getCookies(req) {
  const cookies = {};
  const raw = req.headers.cookie || "";

  raw.split(";").forEach(part => {
    const index = part.indexOf("=");

    if (index === -1) return;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    cookies[key] = decodeURIComponent(value);
  });

  return cookies;
}

function isAdmin(req) {
  const cookies = getCookies(req);
  return !!cookies.admin_session && sessions.has(cookies.admin_session);
}

function requireAdmin(req, res) {
  if (!isAdmin(req)) {
    json(res, 401, {
      ok: false,
      error: "Unauthorized"
    });

    return false;
  }

  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", chunk => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}

function readJsonBody(req) {
  return readBody(req).then(buffer => {
    if (!buffer.length) return {};

    try {
      return JSON.parse(buffer.toString("utf8"));
    } catch {
      return {};
    }
  });
}

function mapProduct(row) {
  return {
    id: String(row.id),
    name: row.name || "",
    price: Number(row.price || 0),
    image: row.image || "",
    description: row.description || "",
    createdAt: row.created_at || null
  };
}

async function supabaseRequest(endpoint, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error("Supabase environment variables are missing");
  }

  const headers = {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: Bearer ${SUPABASE_SECRET_KEY},
    ...options.headers
  };

  const response = await fetch(
    ${SUPABASE_URL}${endpoint},
    {
      ...options,
      headers
    }
  );

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === "string"
        ? data
        : data?.message ⠟⠺⠵⠺⠞⠟⠞⠟⠺⠵⠟⠺⠟ "Supabase error";

    throw new Error(message);
  }

  return data;
}

async function getProducts() {
  const rows = await supabaseRequest(
    "/rest/v1/products?select=*&order=created_at.desc"
  );

  return rows.map(mapProduct);
}

async function createProduct(product) {
  const rows = await supabaseRequest(
    "/rest/v1/products",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        name: product.name,
        price: product.price,
        image: product.image || "",
        description: product.description || ""
      })
    }
  );

  return mapProduct(rows[0]);
}async function updateProduct(id, product) {
  const rows = await supabaseRequest(
    /rest/v1/products?id=eq.${encodeURIComponent(id)},
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        name: product.name,
        price: product.price,
        image: product.image || "",
        description: product.description || ""
      })
    }
  );

  if (!rows.length) {
    throw new Error("Product not found");
  }

  return mapProduct(rows[0]);
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
    await supabaseRequest("/storage/v1/bucket/product-images");
    return;
  } catch {}

  try {
    await supabaseRequest(
      "/storage/v1/bucket",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: "product-images",
          name: "product-images",
          public: true
        })
      }
    );
  } catch {}
}

function parseMultipart(buffer, contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

  if (!match) {
    throw new Error("Multipart boundary not found");
  }

  const boundary = "--" + (match[1] || match[2]);
  const body = buffer.toString("latin1");
  const parts = body.split(boundary);

  const result = [];

  for (const part of parts) {
    if (
      !part ||
      part === "--\r\n" ||
      part === "--"
    ) {
      continue;
    }

    const separator = part.indexOf("\r\n\r\n");

    if (separator === -1) continue;

    const headerText = part.slice(0, separator);
    let content = part.slice(separator + 4);

    if (content.endsWith("\r\n")) {
      content = content.slice(0, -2);
    }

    const nameMatch =
      headerText.match(/name="([^"]+)"/i);

    const fileMatch =
      headerText.match(/filename="([^"]*)"/i);

    const typeMatch =
      headerText.match(/Content-Type:\s*([^\r\n]+)/i);

    if (!nameMatch) continue;

    result.push({
      name: nameMatch[1],
      filename: fileMatch ? fileMatch[1] : null,
      contentType: typeMatch
        ? typeMatch[1].trim()
        : "application/octet-stream",
      data: Buffer.from(content, "latin1")
    });
  }

  return result;
}

async function uploadToSupabase(file) {
  await ensureStorageBucket();

  const ext =
    path.extname(file.filename ⠞⠺⠵⠵⠵⠺⠟⠞⠞⠺⠞⠟⠺⠺⠺⠵⠵⠵⠺ ".jpg";

  const filename =
    ${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext};

  await supabaseRequest(
    /storage/v1/object/product-images/${encodeURIComponent(filename)},
    {
      method: "POST",
      headers: {
        "Content-Type": file.contentType || "application/octet-stream",
        "x-upsert": "true"
      },
      body: file.data
    }
  );

  return ${SUPABASE_URL}/storage/v1/object/public/product-images/${filename};
}

function safeStaticPath(urlPath) {
  let decoded;

  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  decoded = decoded.split("?")[0];

  if (decoded === "/") {
    decoded = "/index.html";
  }

  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");

  const fullPath = path.join(PUBLIC, normalized);

  if (!fullPath.startsWith(PUBLIC)) {
    return null;
  }

  return fullPath;
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();

  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8"
  };

  return types[ext] || "application/octet-stream";
}async function handle(req, res) {
  const url = new URL(
    req.url,
    http://${req.headers.host || "localhost"}
  );

  const p = url.pathname;

  try {
    // PRODUCTS
    if (p === "/api/products" && req.method === "GET") {
      const products = await getProducts();
      return json(res, 200, products);
    }

    // ADMIN LOGIN
    if (p === "/api/admin/login" && req.method === "POST") {
      const body = await readJsonBody(req);

      if (String(body.password || "") !== ADMIN_PASSWORD) {
        return json(res, 401, {
          ok: false,
          error: "رمز عبور اشتباه است"
        });
      }

      const token =
        crypto.randomBytes(32).toString("hex");

      sessions.add(token);

      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie":
          admin_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax
      });

      return res.end(
        JSON.stringify({
          ok: true
        })
      );
    }

    // ADMIN LOGOUT
    if (p === "/api/admin/logout" && req.method === "POST") {
      const cookies = getCookies(req);

      if (cookies.admin_session) {
        sessions.delete(cookies.admin_session);
      }

      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie":
          "admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
      });

      return res.end(
        JSON.stringify({
          ok: true
        })
      );
    }

    // ADMIN CHECK
    if (p === "/api/admin/check" && req.method === "GET") {
      return json(res, 200, {
        ok: isAdmin(req)
      });
    }

    // ADMIN GET PRODUCTS
    if (p === "/api/admin/products" && req.method === "GET") {
      if (!requireAdmin(req, res)) return;

      const products = await getProducts();

      return json(res, 200, products);
    }

    // ADMIN ADD PRODUCT
    if (p === "/api/admin/products" && req.method === "POST") {
      if (!requireAdmin(req, res)) return;

      const body = await readJsonBody(req);

      const name = String(body.name || "").trim();
      const description = String(
        body.description || ""
      ).trim();

      const price = Number(body.price || 0);
      const image = String(body.image || "").trim();

      if (!name) {
        return json(res, 400, {
          ok: false,
          error: "نام محصول وارد نشده"
        });
      }

      const product = await createProduct({
        name,
        price: Math.round(price),
        image,
        description
      });

      return json(res, 201, {
        ok: true,
        product
      });
    }

    // ADMIN UPDATE PRODUCT
    if (
      p.startsWith("/api/admin/products/") &&
      req.method === "PUT"
    ) {
      if (!requireAdmin(req, res)) return;

      const id = p.split("/").pop();
      const body = await readJsonBody(req);

      const product = await updateProduct(id, {
        name: String(body.name || "").trim(),
        price: Math.round(Number(body.price || 0)),
        image: String(body.image || "").trim(),
        description: String(body.description || "").trim()
      });

      return json(res, 200, {
        ok: true,
        product
      });
    }

    // ADMIN DELETE PRODUCT
    if (
      p.startsWith("/api/admin/products/") &&
      req.method === "DELETE"
    ) {
      if (!requireAdmin(req, res)) return;

      const id = p.split("/").pop();

      await deleteProduct(id);

      return json(res, 200, {
        ok: true
      });
    }

    // ADMIN UPLOAD IMAGE
    if (
      p === "/api/admin/upload" &&
      req.method === "POST"
    ) {
      if (!requireAdmin(req, res)) return;

      const contentTypeHeader =
        req.headers["content-type"] || "";

      const body = await readBody(req);

      if (
        !contentTypeHeader
          .toLowerCase()
          .startsWith("multipart/form-data")
      ) {
        return json(res, 400, {
          ok: false,
          error: "فایل ارسال نشده"
        });
      }const parts =
        parseMultipart(body, contentTypeHeader);

      const file = parts.find(x => x.filename);

      if (!file) {
        return json(res, 400, {
          ok: false,
          error: "فایل پیدا نشد"
        });
      }

      const imageUrl =
        await uploadToSupabase(file);

      return json(res, 200, {
        ok: true,
        url: imageUrl,
        image: imageUrl
      });
    }

    // CREATE ORDER
    if (p === "/api/orders" && req.method === "POST") {
      const body = await readJsonBody(req);

      const orders = readJson(ORDERS);

      const order = {
        id:
          Date.now().toString() +
          crypto.randomBytes(3).toString("hex"),
        createdAt: new Date().toISOString(),
        name: body.name || "",
        phone: body.phone || "",
        address: body.address || "",
        items: Array.isArray(body.items)
          ? body.items
          : [],
        total: Number(body.total || 0),
        status: "new"
      };

      orders.unshift(order);

      writeJson(ORDERS, orders);

      return json(res, 201, {
        ok: true,
        order
      });
    }

    // ADMIN GET ORDERS
    if (
      p === "/api/admin/orders" &&
      req.method === "GET"
    ) {
      if (!requireAdmin(req, res)) return;

      return json(res, 200, readJson(ORDERS));
    }

    // ADMIN UPDATE ORDER
    if (
      p.startsWith("/api/admin/orders/") &&
      req.method === "PUT"
    ) {
      if (!requireAdmin(req, res)) return;

      const id = p.split("/").pop();
      const body = await readJsonBody(req);

      const orders = readJson(ORDERS);

      const index =
        orders.findIndex(x => String(x.id) === String(id));

      if (index === -1) {
        return json(res, 404, {
          ok: false,
          error: "Order not found"
        });
      }

      orders[index] = {
        ...orders[index],
        ...body,
        id: orders[index].id
      };

      writeJson(ORDERS, orders);

      return json(res, 200, {
        ok: true,
        order: orders[index]
      });
    }

    // STATIC FILES
    const filePath = safeStaticPath(p);

    if (!filePath) {
      return json(res, 403, {
        ok: false,
        error: "Forbidden"
      });
    }

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);

      if (stat.isFile()) {
        res.writeHead(200, {
          "Content-Type": contentType(filePath),
          "Cache-Control": "public, max-age=3600"
        });

        return fs.createReadStream(filePath).pipe(res);
      }
    }

    // SPA FALLBACK
    const indexPath =
      path.join(PUBLIC, "index.html");

    if (fs.existsSync(indexPath)) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });

      return fs.createReadStream(indexPath).pipe(res);
    }

    return json(res, 404, {
      ok: false,
      error: "Not found"
    });

  } catch (error) {
    console.error(error);

    return json(res, 500, {
      ok: false,
      error: error.message || "Server error"
    });
  }
}

const server = http.createServer(handle);

server.listen(PORT, "0.0.0.0", () => {
  console.log(Shop Black running on port ${PORT});
});
