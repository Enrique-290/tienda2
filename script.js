/* =======================
   Datos demo / estado
======================= */
const state = {
  settings: {
    useEmojis: true,
    emojiStyle: "detailed",     // "compact" | "detailed"
    emojisOnTicket: false,
    negocio: "PetPOS",
    email: "",
    direccion: "",
    tel: "",
    logoDataUrl: ""             // se guarda redimensionado
  },
  products: [
    { sku:"PER-001", nombre:"Croqueta Premium 3kg (Perro)", categoria:"Perros", precio:329, stock:8 },
    { sku:"GAT-001", nombre:"Croqueta Premium 1.5kg (Gato)", categoria:"Gatos", precio:219, stock:8 },
    { sku:"ACC-010", nombre:"Juguete Pelota Reforzada", categoria:"Accesorios", precio:89, stock:15 },
    { sku:"PER-002", nombre:"CROQUETA NORMAL", categoria:"Perros", precio:150, stock:9 }
  ],
  cart: []
};

/* =======================
   Utilidades
======================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function money(n){ return `$${n.toFixed(2)}`; }

function loadState(){
  try{
    const raw = localStorage.getItem("petpos_settings");
    if(raw){
      Object.assign(state.settings, JSON.parse(raw));
    }
  }catch(e){}
}

function saveState(){
  localStorage.setItem("petpos_settings", JSON.stringify(state.settings));
}

function dataUrlFromFile(file, maxW=256){
  return new Promise(res=>{
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img,0,0,w,h);
        res(c.toDataURL("image/png", 0.9));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* =======================
   Emojis ON/OFF
======================= */
function applyEmojiMode(){
  const { useEmojis, emojiStyle } = state.settings;
  $$(".emoji").forEach(el=>{
    const icon = el.getAttribute("data-emoji") || "";
    el.textContent = useEmojis ? icon : "";
  });
  // Compacto: ocultar textos en botones del menú si se desea
  if(emojiStyle === "compact"){
    // en compact mostramos icono y mantenemos texto corto (a elección).
    // Para simplicidad, dejamos ambos; si quieres ocultar texto del menú:
    // $$(".nav .label").forEach(l => l.style.display = "none");
  }else{
    $$(".nav .label").forEach(l => l.style.display = "");
  }
}

/* =======================
   Render Productos
======================= */
function buildCategories(){
  const set = new Set(state.products.map(p=>p.categoria));
  const sel = $("#catFilter");
  sel.innerHTML = `<option value="todas">Todas</option>` + [...set].map(c=>`<option>${c}</option>`).join("");
}

function matchFilter(p){
  const q = $("#q").value.trim().toLowerCase();
  const cat = $("#catFilter").value;
  const min = parseFloat($("#minPrice").value || ""); 
  const max = parseFloat($("#maxPrice").value || "");
  if(q && !(p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q))) return false;
  if(cat!=="todas" && p.categoria!==cat) return false;
  if(!isNaN(min) && p.precio < min) return false;
  if(!isNaN(max) && p.precio > max) return false;
  return true;
}

function renderProducts(){
  const grid = $("#productGrid");
  grid.innerHTML = "";
  state.products.filter(matchFilter).forEach(p=>{
    const el = document.createElement("div");
    el.className = "pcard";
    el.innerHTML = `
      <div class="pthumb">IMG</div>
      <div class="pbody">
        <div class="pname">${p.nombre}</div>
        <div class="pmeta">SKU ${p.sku} • ${p.categoria} • <span class="badge">Stock ${p.stock}</span></div>
        <div class="pprice">${money(p.precio)}</div>
        <div class="prow">
          <input class="qty" type="number" min="1" value="1" />
          <button class="btn primary btn-add"><span class="emoji" data-emoji="➕"></span><span class="txt">Agregar</span></button>
        </div>
      </div>`;
    el.querySelector(".btn-add").addEventListener("click", ()=>{
      const qty = Math.max(1, parseInt(el.querySelector(".qty").value||"1",10));
      addToCart(p.sku, qty);
    });
    grid.appendChild(el);
  });
  applyEmojiMode();
}

/* =======================
   Carrito
======================= */
function addToCart(sku, qty){
  const p = state.products.find(x=>x.sku===sku);
  if(!p) return;
  const row = state.cart.find(x=>x.sku===sku);
  if(row){ row.cant += qty; }
  else state.cart.push({ sku:p.sku, nombre:p.nombre, precio:p.precio, cant:qty, stock:p.stock });
  renderCart();
}

function removeFromCart(sku){
  state.cart = state.cart.filter(x=>x.sku!==sku);
  renderCart();
}

function updateQty(sku, val){
  const it = state.cart.find(x=>x.sku===sku); if(!it) return;
  it.cant = Math.max(1, parseInt(val||"1",10));
  renderCart();
}

function totals(){
  const sub = state.cart.reduce((a,b)=>a+b.precio*b.cant,0);
  const baseIVA = sub;
  const iva = +(baseIVA*0.16).toFixed(2);
  const total = +(sub + iva).toFixed(2);
  return { sub, baseIVA, iva, total };
}

function renderCart(){
  const body = $("#cartBody");
  const foot = $("#cartFoot");
  if(state.cart.length===0){
    body.innerHTML = `<tr><td colspan="7" class="muted">Sin productos</td></tr>`;
    foot.innerHTML = "";
    return;
  }
  body.innerHTML = state.cart.map(it=>`
    <tr>
      <td>${it.nombre}</td>
      <td>${it.sku}</td>
      <td>${it.stock}</td>
      <td><input type="number" min="1" value="${it.cant}" class="qty" data-sku="${it.sku}" /></td>
      <td>${money(it.precio)}</td>
      <td>${money(it.precio*it.cant)}</td>
      <td><button class="btn gray btn-del" data-sku="${it.sku}">✖</button></td>
    </tr>
  `).join("");

  const t = totals();
  foot.innerHTML = `
    <tr><td colspan="5" class="muted">Subtotal</td><td colspan="2">${money(t.sub)}</td></tr>
    <tr><td colspan="5" class="muted">Base IVA</td><td colspan="2">${money(t.baseIVA)}</td></tr>
    <tr><td colspan="5" class="muted">IVA (16%)</td><td colspan="2">${money(t.iva)}</td></tr>
    <tr><td colspan="5" class="muted"><b>Total</b></td><td colspan="2"><b>${money(t.total)}</b></td></tr>
  `;

  $$(".btn-del").forEach(b=> b.addEventListener("click", e=> removeFromCart(b.dataset.sku)));
  $$("#cartBody .qty").forEach(i => i.addEventListener("change", e => updateQty(i.dataset.sku, i.value)));
}

/* =======================
   Ticket
======================= */
function stripEmojis(str){ return str.replace(/\p{Extended_Pictographic}/gu, ""); }

function printTicket(){
  const { negocio, email, direccion, tel, logoDataUrl, emojisOnTicket } = state.settings;
  const cliente = $("#cliente").value || "Público General";
  const pago = $("#pago").value;
  const recibio = ($("#recibio").value||"").trim();
  const t = totals();
  const lines = state.cart.map(it=>`${it.cant} x ${it.nombre} (${it.sku}) @ ${money(it.precio)} = ${money(it.precio*it.cant)}`);

  let html = `
  <html><head>
    <meta charset="utf-8" />
    <style>
      body{font:14px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace}
      .center{text-align:center}
      .ticket-logo{max-width:120px; max-height:120px; object-fit:contain; display:block; margin:0 auto 6px}
      @media print{ .ticket-logo{width:170px; max-height:170px} }
      hr{border:0; border-top:1px dashed #000; margin:.4rem 0}
      .small{font-size:12px}
    </style>
  </head><body>
    ${logoDataUrl ? `<img class="ticket-logo" src="${logoDataUrl}" />` : ""}
    <div class="center"><b>${negocio||"PetPOS"}</b></div>
    <div class="small">
      ${direccion?direccion+"<br>":""}
      ${tel?("Tel: "+tel+"<br>"):""}
      ${email?email+"<br>":""}
    </div>
    <hr/>
    <div class="small">Fecha: ${new Date().toLocaleString()}</div>
    <div class="small">Cliente: ${cliente}</div>
    <div class="small">Pago: ${pago}</div>
    <hr/>
    ${lines.map(l=>`<div>${l}</div>`).join("")}
    <hr/>
    <div>Subtotal: ${money(t.sub)}</div>
    <div>Base IVA: ${money(t.baseIVA)}</div>
    <div>IVA 16%: ${money(t.iva)}</div>
    <div><b>TOTAL: ${money(t.total)}</b></div>
    ${pago==="Efectivo" && recibio ? `<div>Cambio: ${money(Math.max(0, (+recibio) - t.total))}</div>` : ""}
    <hr/>
    <div class="center small">Gracias por su compra</div>
    <script>window.print();<\/script>
  </body></html>`;

  if(!emojisOnTicket) html = stripEmojis(html);
  const w = window.open("");
  w.document.write(html);
  w.document.close();
}

/* =======================
   Configuración
======================= */
function loadConfigToUI(){
  $("#cfgUseEmojis").checked = state.settings.useEmojis;
  $$("input[name='emojiStyle']").forEach(r => r.checked = (r.value===state.settings.emojiStyle));
  $("#cfgEmojisTicket").checked = state.settings.emojisOnTicket;
  $("#cfgNombre").value = state.settings.negocio || "";
  $("#cfgEmail").value = state.settings.email || "";
  $("#cfgDireccion").value = state.settings.direccion || "";
  $("#cfgTel").value = state.settings.tel || "";

  if(state.settings.logoDataUrl){
    $("#cfgLogoPreview").src = state.settings.logoDataUrl;
    $("#brandLogo").src = state.settings.logoDataUrl;
  }else{
    $("#cfgLogoPreview").src = "";
    $("#brandLogo").src = "";
  }
  $("#brandName").textContent = state.settings.negocio || "PetPOS";
  applyEmojiMode();
}

function saveConfigFromUI(){
  state.settings.useEmojis = $("#cfgUseEmojis").checked;
  state.settings.emojiStyle = $$("input[name='emojiStyle']").find(r=>r.checked).value;
  state.settings.emojisOnTicket = $("#cfgEmojisTicket").checked;
  state.settings.negocio = $("#cfgNombre").value.trim() || "PetPOS";
  state.settings.email = $("#cfgEmail").value.trim();
  state.settings.direccion = $("#cfgDireccion").value.trim();
  state.settings.tel = $("#cfgTel").value.trim();
  saveState();
  loadConfigToUI();
}

/* =======================
   Navegación
======================= */
function showView(id){
  $$(".view").forEach(v=>v.classList.remove("active"));
  $("#view-"+id).classList.add("active");
  $$(".nav-item").forEach(b=>b.classList.toggle("active", b.dataset.view===id));
}

/* =======================
   Eventos
======================= */
function bindEvents(){
  // Nav
  $$(".nav-item").forEach(btn => btn.addEventListener("click", ()=> showView(btn.dataset.view)));

  // Filtros
  $("#q").addEventListener("input", renderProducts);
  $("#catFilter").addEventListener("change", renderProducts);
  $("#minPrice").addEventListener("input", renderProducts);
  $("#maxPrice").addEventListener("input", renderProducts);
  $("#btnClear").addEventListener("click", ()=>{
    $("#q").value=""; $("#catFilter").value="todas"; $("#minPrice").value=""; $("#maxPrice").value="";
    renderProducts();
  });

  // Carrito
  $("#btnVaciar").addEventListener("click", ()=>{
    state.cart = []; renderCart();
  });
  $("#btnCobrar").addEventListener("click", ()=>{
    if(state.cart.length===0) return;
    printTicket();
    // Reset post-venta
    state.cart = [];
    $("#cliente").value = "";
    $("#pago").value = "Efectivo";
    $("#recibio").value = "";
    $("#desc").value = "";
    renderCart();
    $("#q").focus();
  });

  // Shortcuts
  document.addEventListener("keydown", (e)=>{
    if(e.ctrlKey && e.key.toLowerCase()==="f"){ e.preventDefault(); $("#q").focus(); }
    if(e.ctrlKey && e.key.toLowerCase()==="b"){ e.preventDefault(); $("#btnCobrar").click(); }
    if(e.key==="Delete"){ $("#btnVaciar").click(); }
  });

  // Config
  $("#cfgLogo").addEventListener("change", async (e)=>{
    const f = e.target.files?.[0]; if(!f) return;
    state.settings.logoDataUrl = await dataUrlFromFile(f, 256);
    saveState(); loadConfigToUI();
  });
  $("#btnGuardarCfg").addEventListener("click", saveConfigFromUI);
  $("#btnResetCfg").addEventListener("click", ()=>{
    localStorage.removeItem("petpos_settings");
    loadState(); loadConfigToUI();
  });

  // Cambios instantáneos de emoji
  $("#cfgUseEmojis").addEventListener("change", ()=>{ state.settings.useEmojis = $("#cfgUseEmojis").checked; saveState(); applyEmojiMode(); });
  $$("input[name='emojiStyle']").forEach(r => r.addEventListener("change", ()=>{
    state.settings.emojiStyle = $$("input[name='emojiStyle']").find(x=>x.checked).value; saveState(); applyEmojiMode();
  }));
}

/* =======================
   Init
======================= */
function init(){
  loadState();
  buildCategories();
  renderProducts();
  renderCart();
  bindEvents();
  loadConfigToUI();
}
init();
