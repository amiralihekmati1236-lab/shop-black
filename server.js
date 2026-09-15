
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");
const PRODUCTS = path.join(DATA, "products.json");
const ORDERS = path.join(DATA, "orders.json");

// Local demo admin password: 1236
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1236";
const sessions = new Set();

for (const d of [DATA, UPLOADS]) fs.mkdirSync(d, { recursive: true });
if (!fs.existsSync(PRODUCTS)) fs.writeFileSync(PRODUCTS, "[]");
if (!fs.existsSync(ORDERS)) fs.writeFileSync(ORDERS, "[]");

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return []; }
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}
function send(res, status, body, type="text/html; charset=utf-8", extra={}) {
  res.writeHead(status, {"Content-Type": type, "Cache-Control":"no-store", ...extra});
  res.end(body);
}
function json(res, status, value) { send(res, status, JSON.stringify(value), "application/json; charset=utf-8"); }
function jsonWithCookie(res, status, value, token) {
  send(res, status, JSON.stringify(value), "application/json; charset=utf-8", {"Set-Cookie":`shop_session=${token}; HttpOnly; SameSite=Lax; Path=/`});
}
function cookieSession(req) {
  const c = req.headers.cookie || "";
  const m = c.match(/shop_session=([^;]+)/);
  return m && sessions.has(m[1]) ? m[1] : null;
}
function requireAdmin(req, res) {
  if (!cookieSession(req)) { json(res, 401, {ok:false, error:"دسترسی غیرمجاز"}); return false; }
  return true;
}
function parseBody(req, limit=15*1024*1024) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > limit) { reject(new Error("حجم درخواست زیاد است")); req.destroy(); }
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("JSON نامعتبر")); }
    });
    req.on("error", reject);
  });
}
function safeName(name) {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0,80);
}
function mimeExt(mime) {
  const map = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"};
  return map[mime] || null;
}
function id() { return crypto.randomUUID(); }

const html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const p = u.pathname;

  try {
    if (p === "/api/products" && req.method === "GET") {
      return json(res, 200, readJson(PRODUCTS));
    }

    if (p === "/api/admin/login" && req.method === "POST") {
      const body = await parseBody(req, 100000);
      if (String(body.password || "") !== ADMIN_PASSWORD) return json(res, 401, {ok:false, error:"رمز عبور اشتباه است"});
      const token = crypto.randomBytes(32).toString("hex");
      sessions.add(token);
      return jsonWithCookie(res, 200, {ok:true}, token);
    }

    if (p === "/api/admin/logout" && req.method === "POST") {
      const s = cookieSession(req); if (s) sessions.delete(s);
      return json(res, 200, {ok:true});
    }

    if (p === "/api/admin/me" && req.method === "GET") {
      return json(res, 200, {loggedIn: !!cookieSession(req)});
    }

    if (p === "/api/admin/products" && req.method === "POST") {
      if (!requireAdmin(req,res)) return;
      const body = await parseBody(req);
      const name = String(body.name||"").trim();
      const price = Number(body.price);
      const description = String(body.description||"").trim();
      const image = String(body.image||"").trim();
      if (!name || !Number.isFinite(price) || price < 0) return json(res,400,{ok:false,error:"نام و قیمت معتبر وارد کنید"});
      const products = readJson(PRODUCTS);
      const item = {id:id(), name, price:Math.round(price), description, image, createdAt:new Date().toISOString()};
      products.unshift(item); writeJson(PRODUCTS, products);
      return json(res,201,{ok:true, product:item});
    }

    if (p.startsWith("/api/admin/products/") && req.method === "PUT") {
      if (!requireAdmin(req,res)) return;
      const pid = p.split("/").pop();
      const body = await parseBody(req);
      const products = readJson(PRODUCTS);
      const i = products.findIndex(x=>x.id===pid);
      if (i<0) return json(res,404,{ok:false,error:"محصول پیدا نشد"});
      const name = String(body.name??products[i].name).trim();
      const price = Number(body.price??products[i].price);
      if (!name || !Number.isFinite(price) || price<0) return json(res,400,{ok:false,error:"اطلاعات محصول نامعتبر است"});
      products[i] = {...products[i], name, price:Math.round(price), description:String(body.description??products[i].description).trim(), image:String(body.image??products[i].image).trim(), updatedAt:new Date().toISOString()};
      writeJson(PRODUCTS,products);
      return json(res,200,{ok:true,product:products[i]});
    }

    if (p.startsWith("/api/admin/products/") && req.method === "DELETE") {
      if (!requireAdmin(req,res)) return;
      const pid = p.split("/").pop();
      const products = readJson(PRODUCTS);
      const item = products.find(x=>x.id===pid);
      if (!item) return json(res,404,{ok:false,error:"محصول پیدا نشد"});
      writeJson(PRODUCTS,products.filter(x=>x.id!==pid));
      if (item.image && item.image.startsWith("/uploads/")) {
        const f = path.join(UPLOADS,path.basename(item.image));
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      return json(res,200,{ok:true});
    }

    if (p === "/api/admin/upload" && req.method === "POST") {
      if (!requireAdmin(req,res)) return;
      const body = await parseBody(req, 15*1024*1024);
      const mime = String(body.mime||"");
      const ext = mimeExt(mime);
      if (!ext || !body.data) return json(res,400,{ok:false,error:"فقط JPG، PNG، WEBP یا GIF مجاز است"});
      const raw = String(body.data).replace(/^data:[^;]+;base64,/,"");
      const buf = Buffer.from(raw,"base64");
      if (buf.length > 8*1024*1024) return json(res,400,{ok:false,error:"حجم عکس باید کمتر از ۸ مگابایت باشد"});
      const filename = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS,filename),buf);
      return json(res,201,{ok:true,url:`/uploads/${filename}`});
    }

    if (p === "/api/orders" && req.method === "POST") {
      const body = await parseBody(req, 500000);
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return json(res,400,{ok:false,error:"سبد خرید خالی است"});
      const products = readJson(PRODUCTS);
      const clean = [];
      let total = 0;
      for (const x of items) {
        const pr = products.find(y=>y.id===x.id);
        const qty = Math.max(1, Math.min(99, Number(x.qty)||1));
        if (!pr) continue;
        clean.push({id:pr.id,name:pr.name,price:pr.price,qty});
        total += pr.price*qty;
      }
      if (!clean.length) return json(res,400,{ok:false,error:"محصولات سفارش پیدا نشدند"});
      const order = {id:id(), items:clean, total, customer:{name:String(body.customer?.name||"").trim(), phone:String(body.customer?.phone||"").trim()}, status:"در انتظار پرداخت", createdAt:new Date().toISOString()};
      const orders=readJson(ORDERS); orders.unshift(order); writeJson(ORDERS,orders);
      return json(res,201,{ok:true,order});
    }

    if (p === "/api/admin/orders" && req.method === "GET") {
      if (!requireAdmin(req,res)) return;
      return json(res,200,readJson(ORDERS));
    }

    if (p.startsWith("/uploads/") && req.method === "GET") {
      const file = path.basename(p);
      const full = path.join(UPLOADS,file);
      if (!fs.existsSync(full)) return send(res,404,"Not found","text/plain; charset=utf-8");
      const ext=path.extname(full).toLowerCase();
      const types={".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".gif":"image/gif"};
      return send(res,200,fs.readFileSync(full),types[ext]||"application/octet-stream");
    }

    if (p === "/admin") {
      return send(res,200,fs.readFileSync(path.join(PUBLIC,"admin.html"),"utf8"));
    }

    // Static files
    let file = p === "/" ? "/index.html" : p;
    file = path.normalize(file).replace(/^(\.\.[\/\\])+/, "");
    const full = path.join(PUBLIC,file);
    if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return send(res,404,"صفحه پیدا نشد","text/plain; charset=utf-8");
    const ext=path.extname(full).toLowerCase();
    const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};
    return send(res,200,fs.readFileSync(full),types[ext]||"application/octet-stream");
  } catch(e) {
    console.error(e);
    return json(res,500,{ok:false,error:e.message||"خطای سرور"});
  }
});

server.listen(PORT,()=>console.log(`SHOP BLACK: http://localhost:${PORT}`));
