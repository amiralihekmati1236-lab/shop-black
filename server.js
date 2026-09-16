const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);

const ROOT = __dirname;
const PUBLIC = ROOT;

const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");

const PRODUCTS = path.join(DATA, "products.json");
const ORDERS = path.join(DATA, "orders.json");

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "1236";

const sessions = new Set();

const SUPABASE_URL =
  String(process.env.SUPABASE_URL || "")
  .replace(/\/$/, "");

const SUPABASE_SECRET_KEY =
  String(process.env.SUPABASE_SECRET_KEY || "");


function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: Bearer ${SUPABASE_SECRET_KEY},
    "Content-Type": "application/json",
    ...extra
  };
}


async function supabaseRequest(table, options = {}) {

  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error(
      "Supabase تنظیم نشده است"
    );
  }

  const response = await fetch(
    ${SUPABASE_URL}/rest/v1/${table}${options.query || ""},
    {
      method: options.method || "GET",
      headers: supabaseHeaders(
        options.headers || {}
      ),
      body: options.body
        ? JSON.stringify(options.body)
        : undefined
    }
  );


  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {}


  if (!response.ok) {
    throw new Error(
      data?.message ||
      text ||
      "Supabase error"
    );
  }


  return data;
}function convertProduct(row) {

  return {
    id: String(row.id),
    name: row.name || "",
    price: Number(row.price) || 0,
    description: row.description || "",
    image: row.image || "",
    createdAt: row.created_at || null
  };

}


async function getProducts(){

  const rows = await supabaseRequest(
    "products",
    {
      query:
      "?select=id,created_at,name,price,image,description&order=created_at.desc"
    }
  );

  return Array.isArray(rows)
    ? rows.map(convertProduct)
    : [];

}


async function createProduct(product){

  const rows = await supabaseRequest(
    "products",
    {
      method:"POST",

      query:
      "?select=id,created_at,name,price,image,description",

      headers:{
        Prefer:"return=representation"
      },

      body:product
    }
  );

  return convertProduct(rows[0]);

}


async function updateProduct(id, product){

  const rows = await supabaseRequest(
    "products",
    {
      method:"PATCH",

      query:
      ?id=eq.${encodeURIComponent(id)}&select=id,created_at,name,price,image,description,

      headers:{
        Prefer:"return=representation"
      },

      body:product
    }
  );

  return rows.length
    ? convertProduct(rows[0])
    : null;

}


async function deleteProduct(id){

  const rows = await supabaseRequest(
    "products",
    {
      method:"DELETE",

      query:
      ?id=eq.${encodeURIComponent(id)}&select=id,image,

      headers:{
        Prefer:"return=representation"
      }
    }
  );

  return rows[0] || null;

}function convertProduct(row) {

  return {
    id: String(row.id),
    name: row.name || "",
    price: Number(row.price) || 0,
    description: row.description || "",
    image: row.image || "",
    createdAt: row.created_at || null
  };

}


async function getProducts(){

  const rows = await supabaseRequest(
    "products",
    {
      query:
      "?select=id,created_at,name,price,image,description&order=created_at.desc"
    }
  );

  return Array.isArray(rows)
    ? rows.map(convertProduct)
    : [];

}


async function createProduct(product){

  const rows = await supabaseRequest(
    "products",
    {
      method:"POST",

      query:
      "?select=id,created_at,name,price,image,description",

      headers:{
        Prefer:"return=representation"
      },

      body:product
    }
  );

  return convertProduct(rows[0]);

}


async function updateProduct(id, product){

  const rows = await supabaseRequest(
    "products",
    {
      method:"PATCH",

      query:
      ?id=eq.${encodeURIComponent(id)}&select=id,created_at,name,price,image,description,

      headers:{
        Prefer:"return=representation"
      },

      body:product
    }
  );

  return rows.length
    ? convertProduct(rows[0])
    : null;

}


async function deleteProduct(id){

  const rows = await supabaseRequest(
    "products",
    {
      method:"DELETE",

      query:
      ?id=eq.${encodeURIComponent(id)}&select=id,image,

      headers:{
        Prefer:"return=representation"
      }
    }
  );

  return rows[0] || null;

}for (const d of [DATA, UPLOADS]) {
  fs.mkdirSync(d, { recursive: true });
}


if (!fs.existsSync(PRODUCTS)) {
  fs.writeFileSync(PRODUCTS, "[]");
}


if (!fs.existsSync(ORDERS)) {
  fs.writeFileSync(ORDERS, "[]");
}



function readJson(file){

  try {
    return JSON.parse(
      fs.readFileSync(file, "utf8")
    );
  }

  catch {
    return [];
  }

}



function writeJson(file, data){

  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2),
    "utf8"
  );

}



function createId(){

  return crypto.randomUUID();

}



function json(res, status, data){

  const body =
    JSON.stringify(data);

  res.writeHead(status, {
    "Content-Type":
      "application/json; charset=utf-8"
  });

  res.end(body);

}



function parseCookies(req){

  const header =
    req.headers.cookie || "";

  const cookies = {};

  header.split(";").forEach(item=>{

    const parts =
      item.split("=");

    if(parts.length===2){

      cookies[
        parts[0].trim()
      ] =
      decodeURIComponent(
        parts[1]
      );

    }

  });


  return cookies;

}



function isAdmin(req){

  const cookies =
    parseCookies(req);

  return cookies.admin_session &&
    sessions.has(
      cookies.admin_session
    );

}function setAdminCookie(req, res, token){

  const secure =
    req.headers["x-forwarded-proto"] === "https"
      ? "; Secure"
      : "";

  res.setHeader(
    "Set-Cookie",
    admin_session=${token}; HttpOnly; Path=/; SameSite=Lax${secure}
  );

}



function clearAdminCookie(res){

  res.setHeader(
    "Set-Cookie",
    "admin_session=; HttpOnly; Path=/; Max-Age=0"
  );

}



async function parseBody(req){

  return new Promise((resolve,reject)=>{

    let data="";


    req.on("data",chunk=>{

      data += chunk;


      if(data.length > 15 * 1024 * 1024){

        reject(
          new Error(
            "حجم اطلاعات زیاد است"
          )
        );

        req.destroy();

      }

    });


    req.on("end",()=>{

      try{

        resolve(
          data ? JSON.parse(data) : {}
        );

      }

      catch(e){

        reject(
          new Error(
            "JSON اشتباه است"
          )
        );

      }

    });


    req.on("error",reject);

  });

}




function serveFile(req,res,pathname){

  let filePath =
    pathname === "/"
      ? path.join(PUBLIC,"index.html")
      : path.join(PUBLIC,pathname);


  filePath =
    path.normalize(filePath);



  if(!filePath.startsWith(PUBLIC)){

    return res.end("Forbidden");

  }



  if(!fs.existsSync(filePath)){

    res.writeHead(404);

    return res.end("Not Found");

  }



  fs.createReadStream(filePath)
    .pipe(res);

}const server = http.createServer(async (req,res)=>{

  try{

    const url =
      new URL(
        req.url,
        http://${req.headers.host}
      );


    const p =
      url.pathname;



    if(
      p === "/api/products" &&
      req.method === "GET"
    ){

      const products =
        await getProducts();

      return json(
        res,
        200,
        products
      );

    }



    if(
      p === "/api/admin/login" &&
      req.method === "POST"
    ){

      const body =
        await parseBody(req);


      if(
        String(body.password)
        !== String(ADMIN_PASSWORD)
      ){

        return json(
          res,
          401,
          {
            ok:false,
            error:"رمز اشتباه است"
          }
        );

      }


      const token =
        crypto.randomBytes(32)
        .toString("hex");


      sessions.add(token);


      setAdminCookie(
        req,
        res,
        token
      );


      return json(
        res,
        200,
        {
          ok:true
        }
      );

    }



    if(
      p === "/api/admin/me"
      &&
      req.method === "GET"
    ){

      return json(
        res,
        200,
        {
          ok:isAdmin(req)
        }
      );

    }



    if(
      p === "/api/admin/products"
      &&
      req.method === "POST"
    ){

      if(!isAdmin(req))
        return json(res,401,{ok:false});


      const body =
        await parseBody(req);


      const product =
        await createProduct({

          name:String(body.name),

          price:Number(body.price),

          description:
            String(body.description||""),

          image:
            String(body.image||"")

        });


      return json(
        res,
        201,
        {
          ok:true,
          product
        }
      );

    }



    if(
      p.startsWith("/uploads/")
    ){

      return serveFile(
        req,
        res,
        p
      );

    }



    return serveFile(
      req,
      res,
      p
    );


  }

  catch(e){

    console.log(e);

    return json(
      res,
      500,
      {
        ok:false,
        error:e.message
      }
    );

  }

});



server.listen(
  PORT,
  ()=>{
    console.log(
      Shop.Black.gun running on ${PORT}
    );
  }
);
