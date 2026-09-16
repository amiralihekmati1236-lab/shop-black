const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1236";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SECRET_KEY = String(
  process.env.SUPABASE_SECRET_KEY || ""
);

const sessions = new Set();

const DATA = path.join(ROOT, "data");
const ORDERS_FILE = path.join(DATA, "orders.json");

fs.mkdirSync(DATA, { recursive: true });

if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, "[]", "utf8");
}

/* =========================
   BASIC HELPERS
========================= */

function json(res, status, data) {
  const body = JSON.stringify(data);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  res.end(body);
}

function text(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type
  });

  res.end(body);
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function writeJsonFile(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function randomId() {
  return crypto.randomBytes(24).toString("hex");
}

function getSession(req) {
  const cookie = req.headers.cookie || "";

  const match = cookie.match(/session=([^;]+)/);

  return match ? match[1] : null;
}

function isAdmin(req) {
  const session = getSession(req);
  return session && sessions.has(session);
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
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 25 * 1024 * 1024) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });

    req.on("error", reject);
  });
}

/* =========================
   SUPABASE
========================= */

async function supabaseRequest(table, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error("Supabase is not configured");
  }

  const url = ${SUPABASE_URL}/rest/v1/${table};

  const headers = {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: Bearer ${SUPABASE_SECRET_KEY},
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body
      ? JSON.stringify(options.body)
      : undefined
  });

  const raw = await response.text();

  let data;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    throw new Error(
      Supabase error ${response.status}: ${raw}
    );
  }

  return data;
}

function mapProduct(product) {
  return {
    id: String(product.id),
    name: product.name || "",
    price: Number(product.price || 0),
    image: product.image || "",
    description: product.description || "",
    createdAt: product.created_at || ""
  };
}

/* =========================
   PRODUCTS
========================= */

async function getProducts() {
  const data = await supabaseRequest(
    "products?select=*&order=created_at.desc"
  );

  return Array.isArray(data)
    ? data.map(mapProduct)
    : [];
}

async function createProduct(product) {
  const data = await supabaseRequest("products", {method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: {
      name: String(product.name || ""),
      price: Number(product.price || 0),
      image: String(product.image || ""),
      description: String(product.description || "")
    }
  });

  return data && data[0]
    ? mapProduct(data[0])
    : null;
}

async function updateProduct(id, product) {
  const data = await supabaseRequest(
    products?id=eq.${encodeURIComponent(id)},
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: {
        name: String(product.name || ""),
        price: Number(product.price || 0),
        image: String(product.image || ""),
        description: String(product.description || "")
      }
    }
  );

  return data && data[0]
    ? mapProduct(data[0])
    : null;
}

async function deleteProduct(id) {
  await supabaseRequest(
    products?id=eq.${encodeURIComponent(id)},
    {
      method: "DELETE"
    }
  );
}

/* =========================
   STORAGE
========================= */

async function createStorageBucket() {
  try {
    const response = await fetch(
      ${SUPABASE_URL}/storage/v1/bucket,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: Bearer ${SUPABASE_SECRET_KEY},
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: "product-images",
          name: "product-images",
          public: true
        })
      }
    );

    if (
      response.ok ||
      response.status === 409
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

async function uploadImage(base64, originalName) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error("Supabase is not configured");
  }

  await createStorageBucket();

  const match = String(base64).match(
    /^data:([^;]+);base64,(.+)$/
  );

  if (!match) {
    throw new Error("Invalid image");
  }

  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");

  const ext =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
      ? "webp"
      : "jpg";

  const filename =
    ${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext};

  const uploadUrl =
    ${SUPABASE_URL}/storage/v1/object/product-images/${filename};

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: Bearer ${SUPABASE_SECRET_KEY},
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body: buffer
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      Image upload failed: ${response.status} ${raw}
    );
  }

  return ${SUPABASE_URL}/storage/v1/object/public/product-images/${filename};
}

/* =========================
   STATIC FILES
========================= */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function serveFile(req, res, pathname) {
  let filePath = path.join(ROOT, pathname);

  if (pathname === "/") {
    filePath = path.join(ROOT, "index.html");
  }

  if (!filePath.startsWith(ROOT)) {
    return text(res, 403, "Forbidden");
  }

  if (!fs.existsSync(filePath)) {
    return text(res, 404, "Not Found");
  }

  const stat = fs.statSync(filePath);

  if (!stat.isFile()) {
    return text(res, 404, "Not Found");
  }

  const ext = path.extname(filePath).toLowerCase();

  res.writeHead(200, {
    "Content-Type":
      MIME[ext] || "application/octet-stream"
  });

  fs.createReadStream(filePath).pipe(res);
}

/* =========================
   SERVER
========================= */const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(
      req.url,
      http://${req.headers.host || "localhost"}
    );

    const pathname = requestUrl.pathname;

    /* ---------- LOGIN ---------- */

    if (
      pathname === "/api/admin/login" &&
      req.method === "POST"
    ) {
      const body = await readBody(req);

      if (
        String(body.password || "") !==
        String(ADMIN_PASSWORD)
      ) {
        return json(res, 401, {
          ok: false,
          error: "رمز عبور اشتباه است"
        });
      }

      const session = randomId();

      sessions.add(session);

      res.writeHead(200, {
        "Content-Type":
          "application/json; charset=utf-8",
        "Set-Cookie":
          session=${session}; HttpOnly; Path=/; SameSite=Lax
      });

      return res.end(
        JSON.stringify({
          ok: true
        })
      );
    }

    /* ---------- LOGOUT ---------- */

    if (
      pathname === "/api/admin/logout" &&
      req.method === "POST"
    ) {
      const session = getSession(req);

      if (session) {
        sessions.delete(session);
      }

      res.writeHead(200, {
        "Content-Type":
          "application/json; charset=utf-8",
        "Set-Cookie":
          "session=; Max-Age=0; HttpOnly; Path=/; SameSite=Lax"
      });

      return res.end(
        JSON.stringify({
          ok: true
        })
      );
    }

    /* ---------- CHECK ADMIN ---------- */

    if (
      pathname === "/api/admin/me" &&
      req.method === "GET"
    ) {
      return json(res, 200, {
        ok: true,
        admin: isAdmin(req)
      });
    }

    /* ---------- PUBLIC PRODUCTS ---------- */

    if (
      pathname === "/api/products" &&
      req.method === "GET"
    ) {
      const products = await getProducts();

      return json(res, 200, products);
    }

    /* ---------- ADMIN PRODUCTS ---------- */

    if (
      pathname === "/api/admin/products" &&
      req.method === "GET"
    ) {
      if (!requireAdmin(req, res)) return;

      const products = await getProducts();

      return json(res, 200, products);
    }

    /* ---------- ADD PRODUCT ---------- */

    if (
      pathname === "/api/admin/products" &&
      req.method === "POST"
    ) {
      if (!requireAdmin(req, res)) return;

      const body = await readBody(req);

      if (!body.name) {
        return json(res, 400, {
          ok: false,
          error: "نام محصول وارد نشده"
        });
      }

      const product = await createProduct({
        name: body.name,
        price: body.price,
        image: body.image,
        description: body.description
      });

      return json(res, 201, {
        ok: true,
        product
      });
    }

    /* ---------- EDIT PRODUCT ---------- */

    if (
      pathname.startsWith("/api/admin/products/") &&
      req.method === "PUT"
    ) {
      if (!requireAdmin(req, res)) return;

      const id = pathname.split("/").pop();

      const body = await readBody(req);

      const product = await updateProduct(id, {
        name: body.name,
        price: body.price,
        image: body.image,
        description: body.description
      });

      return json(res, 200, {
        ok: true,
        product
      });
    }

    /* ---------- DELETE PRODUCT ---------- */

    if (
      pathname.startsWith("/api/admin/products/") &&
      req.method === "DELETE"
    ) {
      if (!requireAdmin(req, res)) return;

      const id = pathname.split("/").pop();

      await deleteProduct(id);

      return json(res, 200, {
        ok: true
      });
    }

    /* ---------- UPLOAD IMAGE ---------- */

    if (
      pathname === "/api/admin/upload" &&
      req.method === "POST"
    ) {
      if (!requireAdmin(req, res)) return;

      const body = await readBody(req);

      if (!body.image) {
        return json(res, 400, {
          ok: false,
          error: "تصویر ارسال نشده"
        });
      }

      const imageUrl = await uploadImage(
        body.image,
        body.name || "product"
      );return json(res, 200, {
        ok: true,
        url: imageUrl,
        image: imageUrl
      });
    }

    /* ---------- ORDERS ---------- */

    if (
      pathname === "/api/orders" &&
      req.method === "POST"
    ) {
      const body = await readBody(req);

      const orders = readJsonFile(ORDERS_FILE);

      const order = {
        id: randomId(),
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

      writeJsonFile(ORDERS_FILE, orders);

      return json(res, 201, {
        ok: true,
        order
      });
    }

    /* ---------- ADMIN ORDERS ---------- */

    if (
      pathname === "/api/admin/orders" &&
      req.method === "GET"
    ) {
      if (!requireAdmin(req, res)) return;

      return json(
        res,
        200,
        readJsonFile(ORDERS_FILE)
      );
    }

    /* ---------- HEALTH ---------- */

    if (
      pathname === "/api/health" &&
      req.method === "GET"
    ) {
      return json(res, 200, {
        ok: true,
        supabase: Boolean(
          SUPABASE_URL &&
          SUPABASE_SECRET_KEY
        )
      });
    }

    /* ---------- STATIC ---------- */

    if (req.method === "GET") {
      return serveFile(req, res, pathname);
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
});

server.listen(PORT, () => {
  console.log(
    Shop Black server running on port ${PORT}
  );

  console.log(
    "Supabase:",
    SUPABASE_URL ? "configured" : "NOT configured"
  );
});
