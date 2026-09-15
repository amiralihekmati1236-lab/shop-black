
let products=[], cart=JSON.parse(localStorage.getItem("shop_black_cart")||"[]");
const money=n=>new Intl.NumberFormat("fa-IR").format(n)+" تومان";
async function load(){products=await (await fetch("/api/products")).json();renderProducts();updateCount()}
function renderProducts(){
 const q=(document.getElementById("search")?.value||"").trim().toLowerCase();
 const list=products.filter(p=>(p.name+" "+p.description).toLowerCase().includes(q));
 document.getElementById("grid").innerHTML=list.length?list.map(p=>`<article class="product"><div class="productImg">${p.image?`<img src="${p.image}" alt="">`:`<div class="noImg">✦</div>`}</div><div class="productBody"><h3>${esc(p.name)}</h3><div class="desc">${esc(p.description||"محصول منتخب SHOP BLACK")}</div><div class="price">${money(p.price)}</div><button class="goldBtn wide" onclick="add('${p.id}')">افزودن به سبد خرید</button></div></article>`).join(""):`<p class="muted">محصولی پیدا نشد.</p>`;
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function add(id){let x=cart.find(a=>a.id===id);x?x.qty++:cart.push({id,qty:1});save();openCart()}
function save(){localStorage.setItem("shop_black_cart",JSON.stringify(cart));updateCount()}
function updateCount(){document.getElementById("cartCount").textContent=cart.reduce((a,x)=>a+x.qty,0)}
function openCart(){renderCart();document.getElementById("cartModal").classList.add("show")}
function closeCart(){document.getElementById("cartModal").classList.remove("show")}
function renderCart(){let box=document.getElementById("cartItems"),total=0;if(!cart.length){box.innerHTML='<p class="muted">سبد خرید خالی است.</p>';document.getElementById("cartTotal").textContent=money(0);return}box.innerHTML=cart.map(x=>{let p=products.find(p=>p.id===x.id);if(!p)return"";total+=p.price*x.qty;return `<div class="cartRow"><div><b>${esc(p.name)}</b><div class="muted">${money(p.price)}</div></div><div class="qty"><button onclick="change('${x.id}',-1)">−</button> ${x.qty} <button onclick="change('${x.id}',1)">+</button><button onclick="removeItem('${x.id}')">حذف</button></div></div>`}).join("");document.getElementById("cartTotal").textContent=money(total)}
function change(id,d){let x=cart.find(a=>a.id===id);if(!x)return;x.qty+=d;if(x.qty<1)cart=cart.filter(a=>a.id!==id);save();renderCart()}
function removeItem(id){cart=cart.filter(a=>a.id!==id);save();renderCart()}
function checkout(){if(!cart.length)return alert("سبد خرید خالی است");let total=cart.reduce((s,x)=>{let p=products.find(p=>p.id===x.id);return s+(p?p.price*x.qty:0)},0);document.getElementById("payTotal").textContent=money(total);document.getElementById("payModal").classList.add("show");closeCart();sendOrder()}
async function sendOrder(){try{await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:cart})})}catch{}}
function closePay(){document.getElementById("payModal").classList.remove("show")}
load();
