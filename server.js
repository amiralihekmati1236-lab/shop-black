const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Busboy = require("busboy");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1236";
const sessions = new Map();

function sendJson(res, status, data, extra={}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {"Content-Type":"application/json; charset=utf-8", ...extra});
  res.end(body);
}
function body(req) {
  return new Promise((resolve,reject)=>{
    let s="";
    req.on("data",c=>s+=c);
    req.on("end",()=>resolve(s));
    req.on("error",reject);
  });
}
async function supabase(endpoint, opts={}) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error("Supabase env vars are missing");
  const r = await fetch(SUPABASE_URL + endpoint, {
    ...opts,
    headers:{
      apikey:SUPABASE_SECRET_KEY,
      Authorization:"Bearer "+SUPABASE_SECRET_KEY,
      "Content-Type":"application/json",
      ...(opts.headers||{})
    }
  });
  const t=await r.text();
  let d; try{d=t?JSON.parse(t):null}catch{d=t}
  if(!r.ok) throw new Error(typeof d==="string"?d:JSON.stringify(d));
  return d;
}
function isAdmin(req){
  const m=(req.headers.cookie||"").match(/(?:^|;\s*)admin_session=([^;]+)/);
  if(!m) return false;
  const exp=sessions.get(m[1]);
  if(!exp || exp<Date.now()){sessions.delete(m[1]);return false}
  return true;
}
function staticFile(req,res){
  let p=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  if(p==="/") p="/index.html";
  const file=path.join(ROOT,p.replace(/^\/+/,""));
  if(!file.startsWith(ROOT)) return sendJson(res,403,{error:"forbidden"});
  fs.readFile(file,(e,data)=>{
    if(e) return sendJson(res,404,{error:"not found"});
    const ext=path.extname(file).toLowerCase();
    const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".svg":"image/svg+xml"};
    res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream"});
    res.end(data);
  });
}
async function uploadImage(req,res){
  if(!isAdmin(req)) return sendJson(res,401,{error:"unauthorized"});
  const bb=Busboy({headers:req.headers});
  let buf=null, name="image";
  bb.on("file",(field,file,info)=>{
    name=(info.filename||"image").replace(/[^a-zA-Z0-9._-]/g,"_");
    const chunks=[];
    file.on("data",d=>chunks.push(d));
    file.on("end",()=>buf=Buffer.concat(chunks));
  });
  bb.on("finish",async()=>{
    try{
      if(!buf) return sendJson(res,400,{error:"no file"});
      const objectName=Date.now()+"-"+crypto.randomBytes(5).toString("hex")+"-"+name;
      const r=await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${encodeURIComponent(objectName)}`,{
        method:"POST",
        headers:{apikey:SUPABASE_SECRET_KEY,Authorization:"Bearer "+SUPABASE_SECRET_KEY,"Content-Type":"application/octet-stream"},
        body:buf
      });
      if(!r.ok) throw new Error(await r.text());
      sendJson(res,200,{url:`${SUPABASE_URL}/storage/v1/object/public/product-images/${encodeURIComponent(objectName)}`});
    }catch(e){sendJson(res,500,{error:e.message})}
  });
  req.pipe(bb);
}

const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,"http://localhost"), p=u.pathname;

    if(req.method==="GET"&&p==="/api/products") return sendJson(res,200,await supabase("/rest/v1/products?select=*&order=id.desc"));
    if(req.method==="GET"&&p==="/api/videos") return sendJson(res,200,await supabase("/rest/v1/videos?select=*&order=id.desc"));
    if(req.method==="POST"&&p==="/api/orders"){
      const data=JSON.parse(await body(req)||"{}");
      return sendJson(res,201,await supabase("/rest/v1/orders",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify(data)}));
    }

    if(req.method==="POST"&&p==="/api/admin/login"){
      const data=JSON.parse(await body(req)||"{}");
      if(data.password!==ADMIN_PASSWORD) return sendJson(res,401,{error:"رمز عبور اشتباه است"});
      const token=crypto.randomBytes(24).toString("hex");
      sessions.set(token,Date.now()+86400000); 
    }return sendJson(res, 200, {ok:true}, {"Set-Cookie": "admin_session=" + token + "; HttpOnly; Path=/; SameSite=Lax"});
    if(req.method==="POST"&&p==="/api/admin/logout"){
      const m=(req.headers.cookie||"").match(/(?:^|;\s*)admin_session=([^;]+)/);
      if(m)sessions.delete(m[1]);
      return sendJson(res,200,{ok:true},{Set-Cookie:"admin_session=; Max-Age=0; Path=/"});
    }
    if(p.startsWith("/api/admin/")&&!isAdmin(req)) return sendJson(res,401,{error:"unauthorized"});
    if(req.method==="GET"&&p==="/api/admin/check") return sendJson(res,200,{ok:true});

    if(req.method==="GET"&&p==="/api/admin/products") return sendJson(res,200,await supabase("/rest/v1/products?select=*&order=id.desc"));
    if(req.method==="POST"&&p==="/api/admin/products"){
      const data=JSON.parse(await body(req)||"{}");
      return sendJson(res,201,await supabase("/rest/v1/products",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify(data)}));
    }
    if((req.method==="PUT"||req.method==="PATCH")&&p.startsWith("/api/admin/products/")){
      const id=p.split("/").pop(), data=JSON.parse(await body(req)||"{}");
      return sendJson(res,200,await supabase(`/rest/v1/products?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify(data)}));
    }
    if(req.method==="DELETE"&&p.startsWith("/api/admin/products/")){
      const id=p.split("/").pop();
      await supabase(`/rest/v1/products?id=eq.${encodeURIComponent(id)}`,{method:"DELETE"});
      return sendJson(res,200,{ok:true});
    }

    if(req.method==="GET"&&p==="/api/admin/videos") return sendJson(res,200,await supabase("/rest/v1/videos?select=*&order=id.desc"));
    if(req.method==="POST"&&p==="/api/admin/videos"){
      const data=JSON.parse(await body(req)||"{}");
      return sendJson(res,201,await supabase("/rest/v1/videos",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify(data)}));
    }
    if(req.method==="DELETE"&&p.startsWith("/api/admin/videos/")){
      const id=p.split("/").pop();
      await supabase(`/rest/v1/videos?id=eq.${encodeURIComponent(id)}`,{method:"DELETE"});
      return sendJson(res,200,{ok:true});
    }

    if(req.method==="GET"&&p==="/api/admin/orders") return sendJson(res,200,await supabase("/rest/v1/orders?select=*&order=id.desc"));
    if(req.method==="PATCH"&&p.startsWith("/api/admin/orders/")){
      const id=p.split("/").pop(), data=JSON.parse(await body(req)||"{}");
      return sendJson(res,200,await supabase(`/rest/v1/orders?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify(data)}));
    }

    if(req.method==="POST"&&p==="/api/admin/upload-image") return uploadImage(req,res);
    staticFile(req,res);
  }catch(e){console.error(e);sendJson(res,500,{error:e.message})}
});
server.listen(PORT,()=>console.log(`Shop Black running on port ${PORT}`));
