/* ========= Estado & utilidades ========= */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const store = {
  get(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def; }catch{ return def } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

const fmt = n => (Number(n)||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});

/* ========= Config por defecto ========= */
const DEFAULT_CFG = {
  usarEmojis: true,
  emojiStyle: 'detailed', // compact|detailed
  emojiTicket: false,
  biz: { nombre:'PetPOS', direccion:'', email:'', tel:'', logo:'' }
};

const DEFAULT_PRODS = [
  {sku:'PER-001', nombre:'Croqueta Premium 3kg (Perro)', categoria:'Perros', precio:329, costo:240, stock:8, min:2, caducidad:'', lote:'L-001', img:''},
  {sku:'GAT-001', nombre:'Croqueta Premium 1.5kg (Gato)', categoria:'Gatos', precio:219, costo:160, stock:9, min:2, caducidad:'', lote:'L-002', img:''},
  {sku:'ACC-010', nombre:'Juguete Pelota Reforzada', categoria:'Accesorios', precio:89, costo:35, stock:15, min:5, caducidad:'', lote:'', img:''},
  {sku:'PER-002', nombre:'CROQUETA NORMAL', categoria:'Perros', precio:150, costo:75, stock:7, min:2, caducidad:'2025-10-31', lote:'452255', img:''},
];

/* ========= Estado global ========= */
let CFG = store.get('cfg', DEFAULT_CFG);
let PRODS = store.get('prods', DEFAULT_PRODS);
let VENTAS = store.get('ventas', []); // para reportes/historial (simple demo)
let CARRITO = [];

/* ========= Layout: navegación & sidebar ========= */
function setActive(hash){
  if(!hash) hash = '#dashboard';
  $$('.nav-link').forEach(a=>{
    const active = a.getAttribute('href')===hash;
    a.classList.toggle('active', active);
  });
  $$('.view').forEach(v=>v.classList.remove('visible'));
  const target = document.querySelector(hash);
  if(target) target.classList.add('visible');
}

window.addEventListener('hashchange', ()=> setActive(location.hash));
setActive(location.hash || '#ventas');

$('#toggleSidebar').addEventListener('click', ()=>{
  $('#sidebar').classList.toggle('collapsed');
});

/* ========= Emojis (feature flag seguro) ========= */
function applyEmojiFlag(){
  document.body.classList.toggle('use-emojis', !!CFG.usarEmojis);
  // estilo: solo icono vs icono+texto (para el menú)
  if(CFG.emojiStyle==='compact'){
    // En compacto ocultamos texto extra (pero mantenemos layout)
    // Aquí podrías ajustar si deseas más compacto.
  }
}
applyEmojiFlag();

/* ========= Marca / logo ========= */
function hydrateBrand(){
  const src = CFG.biz.logo || '';
  const el = $('#brandLogo');
  if(src){ el.src = src; } else { el.removeAttribute('src'); }
}
hydrateBrand();

/* ========= Ventas: filtros + grid ========= */
function categorias(){
  const set = new Set(PRODS.map(p=>p.categoria));
  return ['Todas',...Array.from(set)];
}
function renderFiltroCategorias(){
  const sel = $('#filtroCat'); sel.innerHTML='';
  categorias().forEach(cat=>{
    const opt = document.createElement('option');
    opt.textContent = cat; sel.appendChild(opt);
  });
}
renderFiltroCategorias();

function prodCard(p){
  const card = document.createElement('div');
  card.className = 'pcard';

  const img = document.createElement('img');
  img.className = 'pimg';
  img.alt = 'IMG';
  img.src = p.img || '';
  card.appendChild(img);

  const meta = document.createElement('div');
  meta.className = 'pmeta';
  meta.innerHTML = `
    <div><b>${p.nombre}</b></div>
    <div class="sku">SKU ${p.sku} • ${p.categoria} • <span class="badge">Stock ${p.stock}</span></div>
    <div class="pfoot">
      <div><b>${fmt(p.precio)}</b></div>
      <input class="input qty" type="number" min="1" step="1" value="1" />
      <button class="btn primary addBtn">➕ Agregar</button>
    </div>
  `;
  card.appendChild(meta);

  card.querySelector('.addBtn').addEventListener('click', ()=>{
    const q = Math.max(1, Number(card.querySelector('.qty').value||1));
    addToCart(p.sku, q);
  });

  return card;
}

function renderProductos(){
  const grid = $('#gridProductos'); grid.innerHTML='';
  const q = ($('#buscar').value||'').toLowerCase();
  const cat = $('#filtroCat').value||'Todas';
  const pMin = Number($('#pMin').value || 0);
  const pMax = Number($('#pMax').value || 0);

  let list = PRODS.filter(p=>{
    const hits = [p.sku,p.nombre,p.categoria].join(' ').toLowerCase().includes(q);
    const okCat = (cat==='Todas') || p.categoria===cat;
    const okMin = pMin? p.precio>=pMin : true;
    const okMax = pMax? p.precio<=pMax : true;
    return hits && okCat && okMin && okMax;
  });

  list.forEach(p=> grid.appendChild(prodCard(p)));
}
['input','change'].forEach(ev=>{
  $('#buscar').addEventListener(ev, renderProductos);
  $('#filtroCat').addEventListener(ev, renderProductos);
  $('#pMin').addEventListener(ev, renderProductos);
  $('#pMax').addEventListener(ev, renderProductos);
});
$('#btnLimpiarFiltros').addEventListener('click', ()=>{
  $('#buscar').value=''; $('#filtroCat').value='Todas'; $('#pMin').value=''; $('#pMax').value='';
  renderProductos();
});
renderProductos();

/* ========= Carrito ========= */
function addToCart(sku, q=1){
  const p = PRODS.find(x=>x.sku===sku);
  if(!p) return;
  const exist = CARRITO.find(x=>x.sku===sku);
  if(exist){ exist.cant += q; }
  else { CARRITO.push({sku:p.sku, nombre:p.nombre, precio:p.precio, stock:p.stock, cant:q}); }
  renderCarrito();
}
function removeFromCart(sku){
  CARRITO = CARRITO.filter(x=>x.sku!==sku);
  renderCarrito();
}
function updateCant(sku, val){
  const it = CARRITO.find(x=>x.sku===sku);
  if(!it) return;
  it.cant = Math.max(1, Number(val||1));
  renderCarrito();
}

function renderCarrito(){
  const tb = $('#tbodyCarrito'); tb.innerHTML='';
  if(CARRITO.length===0){
    tb.innerHTML = `<tr><td colspan="7" class="empty">Sin productos</td></tr>`;
  }else{
    CARRITO.forEach(it=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${it.nombre}</td>
        <td>${it.sku}</td>
        <td>${it.stock}</td>
        <td><input type="number" class="input qty" min="1" step="1" value="${it.cant}"></td>
        <td>${fmt(it.precio)}</td>
        <td>${fmt(it.precio*it.cant)}</td>
        <td><button class="btn danger outline">✖</button></td>
      `;
      tr.querySelector('.qty').addEventListener('input', e=> updateCant(it.sku, e.target.value));
      tr.querySelector('.btn').addEventListener('click', ()=> removeFromCart(it.sku));
      tb.appendChild(tr);
    });
  }
  calcTotales();
}
function calcTotales(){
  const sub = CARRITO.reduce((a,b)=> a + b.precio*b.cant, 0);
  const desc = Number($('#descInput').value||0);
  const base = Math.max(0, sub - desc);
  const iva = +(base*0.16).toFixed(2);
  const total = base + iva;
  $('#tSubtotal').textContent = fmt(sub);
  $('#tDesc').textContent = fmt(desc);
  $('#tBase').textContent = fmt(base);
  $('#tIVA').textContent = fmt(iva);
  $('#tTotal').textContent = fmt(total);
  const pago = $('#pagoInput').value;
  const rec = Number($('#recibioInput').value||0);
  $('#tCambio').textContent = pago==='Efectivo' ? fmt(Math.max(0, rec-total)) : fmt(0);

  // KPIs rápidos
  $('#kStock').textContent = PRODS.reduce((a,b)=>a+b.stock,0);
}
['input','change'].forEach(ev=>{
  $('#descInput').addEventListener(ev, calcTotales);
  $('#pagoInput').addEventListener(ev, calcTotales);
  $('#recibioInput').addEventListener(ev, calcTotales);
});
renderCarrito();

/* Vaciar y cobrar */
$('#vaciarBtn').addEventListener('click', ()=>{ CARRITO=[]; renderCarrito(); });
$('#cobrarBtn').addEventListener('click', cobrarEImprimir);

function cobrarEImprimir(){
  if(CARRITO.length===0) return;

  // Totales actuales
  const sub = CARRITO.reduce((a,b)=> a + b.precio*b.cant, 0);
  const desc = Number($('#descInput').value||0);
  const base = Math.max(0, sub - desc);
  const iva = +(base*0.16).toFixed(2);
  const total = base + iva;

  // Actualizar stock
  CARRITO.forEach(it=>{
    const p = PRODS.find(x=>x.sku===it.sku);
    if(p){ p.stock = Math.max(0, p.stock - it.cant); }
  });
  store.set('prods', PRODS);

  // Guardar venta muy simple
  const venta = {
    id: 'T'+Date.now(),
    fecha: new Date().toISOString(),
    cliente: $('#clienteInput').value || 'Público General',
    pago: $('#pagoInput').value,
    lineas: CARRITO.map(x=>({sku:x.sku, nombre:x.nombre, cant:x.cant, precio:x.precio})),
    sub, desc, base, iva, total
  };
  VENTAS.push(venta); store.set('ventas', VENTAS);

  // Ticket
  imprimirTicket(venta);

  // Reset a tus defaults
  CARRITO = [];
  $('#clienteInput').value = '';
  $('#pagoInput').value = 'Efectivo';
  $('#recibioInput').value = '';
  $('#descInput').value = '';
  renderCarrito();
  renderProductos(); // actualiza badges de stock
  hydrateKPIs();
}

function hydrateKPIs(){
  const hoy = new Date().toISOString().slice(0,10);
  const vhoy = VENTAS.filter(v=> v.fecha.slice(0,10)===hoy);
  const totalHoy = vhoy.reduce((a,b)=> a+b.total, 0);
  $('#kVentasHoy').textContent = fmt(totalHoy);
  $('#kTickets').textContent = vhoy.length;
  const gan = vhoy.reduce((a,b)=>{
    const costo = b.lineas.reduce((c,l)=>{
      const p = PRODS.find(x=>x.sku===l.sku);
      return c + (p? p.costo*l.cant : 0);
    },0);
    return a + (b.total - (b.iva||0) - costo);
  },0);
  $('#kGanancia').textContent = fmt(gan);
}
hydrateKPIs();

/* ========= Ticket ========= */
function imprimirTicket(venta){
  const win = window.open('', '_blank');
  const logo = CFG.biz.logo ? `<img class="ticket-logo" src="${CFG.biz.logo}" alt="logo" />` : '';
  const showEmoji = CFG.emojiTicket ? '🧾 ' : '';
  const lines = venta.lineas.map(l=>`${l.cant} × ${l.nombre} (${l.sku}) @ ${fmt(l.precio)} = ${fmt(l.cant*l.precio)}`).join('\n');

  win.document.write(`
    <html><head>
      <meta charset="utf-8" />
      <title>Ticket</title>
      <link rel="stylesheet" href="style.css" />
    </head>
    <body>
      <div class="ticket">
        ${logo}
        <div style="text-align:center; white-space:pre-wrap">
          <b>${CFG.biz.nombre||'PetPOS'}</b>
          ${CFG.biz.direccion||''}<br/>
          Tel: ${CFG.biz.tel||''}  ${CFG.biz.email||''}
        </div>
        <hr/>
        <div>${showEmoji}Ticket: ${venta.id}</div>
        <div>Fecha: ${new Date(venta.fecha).toLocaleString('es-MX')}</div>
        <div>Cliente: ${venta.cliente}</div>
        <hr/>
        <pre style="white-space:pre-wrap">${lines}</pre>
        <hr/>
        <div>Subtotal: ${fmt(venta.sub)}</div>
        <div>Descuento: ${fmt(venta.desc)}</div>
        <div>Base IVA: ${fmt(venta.base)}</div>
        <div>IVA 16%: ${fmt(venta.iva)}</div>
        <div><b>TOTAL: ${fmt(venta.total)}</b></div>
        <br/>
        <div style="text-align:center">${CFG.biz.msj || 'Gracias por su compra'}</div>
      </div>
      <script>window.print();</script>
    </body></html>
  `);
  win.document.close();
}

/* ========= Inventario (CRUD básico y subida de imagen) ========= */
function readFileAsDataURL(file){
  return new Promise((res,rej)=>{
    const fr = new FileReader();
    fr.onload = ()=> res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

$('#imgFile').addEventListener('change', async (e)=>{
  const f = e.target.files?.[0];
  if(!f) return;
  const url = await readFileAsDataURL(f);
  $('#imgUrl').value = url; // guardamos en campo para usar en guardar
});

$('#guardarProd').addEventListener('click', ()=>{
  const p = {
    sku: $('#sku').value.trim(),
    nombre: $('#nombre').value.trim(),
    categoria: $('#categoria').value.trim() || 'General',
    precio: Number($('#precio').value||0),
    costo: Number($('#costo').value||0),
    stock: Number($('#stock').value||0),
    min: Number($('#stockMin').value||0),
    caducidad: $('#caducidad').value||'',
    lote: $('#lote').value||'',
    img: $('#imgUrl').value||''
  };
  if(!p.sku || !p.nombre){ alert('SKU y Nombre son obligatorios'); return; }
  const exist = PRODS.findIndex(x=>x.sku===p.sku);
  if(exist>=0) PRODS[exist] = p; else PRODS.push(p);
  store.set('prods', PRODS);
  renderProductos(); renderInventario();
  eToast('Producto guardado');
});

function renderInventario(){
  const tb = $('#tbodyInv'); tb.innerHTML='';
  const q = ($('#buscarInv').value||'').toLowerCase();
  PRODS.filter(p=>{
    return [p.sku,p.nombre,p.categoria].join(' ').toLowerCase().includes(q);
  }).forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.img? `<img src="${p.img}" style="width:44px;height:44px;object-fit:cover;border-radius:8px"/>`:'—'}</td>
      <td>${p.sku}</td><td>${p.nombre}</td><td>${p.categoria}</td>
      <td>${fmt(p.precio)}</td><td>${fmt(p.costo)}</td>
      <td>${p.stock}</td><td>${p.min}</td>
      <td>${p.caducidad||'—'}</td><td>${p.lote||'—'}</td>
      <td>
        <button class="btn ghost edit">Editar</button>
        <button class="btn danger outline del">Borrar</button>
        <button class="btn" data-add="+1">+1</button>
      </td>
    `;
    tr.querySelector('.edit').addEventListener('click', ()=>{
      // Cargar a formulario
      $('#sku').value=p.sku; $('#nombre').value=p.nombre; $('#categoria').value=p.categoria;
      $('#precio').value=p.precio; $('#costo').value=p.costo; $('#stock').value=p.stock;
      $('#stockMin').value=p.min; $('#caducidad').value=p.caducidad; $('#lote').value=p.lote;
      $('#imgUrl').value=p.img||'';
      location.hash = '#inventario'; setActive('#inventario');
    });
    tr.querySelector('.del').addEventListener('click', ()=>{
      PRODS = PRODS.filter(x=>x.sku!==p.sku); store.set('prods', PRODS);
      renderInventario(); renderProductos();
    });
    tr.querySelector('[data-add]').addEventListener('click', ()=>{
      p.stock += 1; store.set('prods', PRODS); renderInventario(); renderProductos();
    });
    tb.appendChild(tr);
  });
}
$('#buscarInv').addEventListener('input', renderInventario);
$('#exportInv').addEventListener('click', ()=> downloadCSV(PRODS, 'inventario.csv'));
renderInventario();

/* ========= Reportes / Respaldos ========= */
$('#exportVentasDet').addEventListener('click', ()=>{
  // Detalle por línea
  const rows = [];
  VENTAS.forEach(v=>{
    v.lineas.forEach(l=>{
      rows.push({
        ticket:v.id, fecha:v.fecha, cliente:v.cliente, pago:v.pago,
        sku:l.sku, nombre:l.nombre, cantidad:l.cant, precio:l.precio,
        subtotal:(l.cant*l.precio), desc:v.desc, base:v.base, iva:v.iva, total:v.total
      });
    });
  });
  downloadCSV(rows,'ventas_detallado.csv');
});
$('#backupBtn').addEventListener('click', ()=>{
  const data = { cfg:CFG, prods:PRODS, ventas:VENTAS };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download='petpos_backup.json'; a.click();
});
$('#restoreFile').addEventListener('change', async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  const txt = await f.text();
  try{
    const data = JSON.parse(txt);
    if(data.cfg) { CFG = data.cfg; store.set('cfg', CFG); applyEmojiFlag(); hydrateBrand(); hydrateConfigForm(); }
    if(data.prods){ PRODS = data.prods; store.set('prods', PRODS); renderProductos(); renderInventario(); }
    if(data.ventas){ VENTAS = data.ventas; store.set('ventas', VENTAS); hydrateKPIs(); }
    eToast('Respaldo importado');
  }catch(err){ alert('Archivo inválido'); }
});

/* ========= Config form ========= */
function hydrateConfigForm(){
  $('#toggleEmojis').checked = !!CFG.usarEmojis;
  $$('input[name="emojiStyle"]').forEach(r=> r.checked = (r.value===CFG.emojiStyle));
  $('#toggleEmojiTicket').checked = !!CFG.emojiTicket;
  $('#bizNombre').value = CFG.biz.nombre || '';
  $('#bizDireccion').value = CFG.biz.direccion || '';
  $('#bizEmail').value = CFG.biz.email || '';
  $('#bizTel').value = CFG.biz.tel || '';
  if(CFG.biz.logo){ $('#logoPreview').src = CFG.biz.logo; } else { $('#logoPreview').removeAttribute('src'); }
}
hydrateConfigForm();

$('#toggleEmojis').addEventListener('change', e=>{
  CFG.usarEmojis = e.target.checked; store.set('cfg', CFG); applyEmojiFlag();
});
$$('input[name="emojiStyle"]').forEach(r=> r.addEventListener('change', e=>{
  CFG.emojiStyle = e.target.value; store.set('cfg', CFG); applyEmojiFlag();
}));
$('#toggleEmojiTicket').addEventListener('change', e=>{
  CFG.emojiTicket = e.target.checked; store.set('cfg', CFG);
});

$('#logoFile').addEventListener('change', async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  const url = await readFileAsDataURL(f);
  CFG.biz.logo = url; store.set('cfg', CFG);
  $('#logoPreview').src = url; hydrateBrand();
});
$('#guardarConfig').addEventListener('click', ()=>{
  CFG.biz.nombre = $('#bizNombre').value.trim();
  CFG.biz.direccion = $('#bizDireccion').value.trim();
  CFG.biz.email = $('#bizEmail').value.trim();
  CFG.biz.tel = $('#bizTel').value.trim();
  store.set('cfg', CFG);
  eToast('Configuración guardada');
});
$('#restablecerConfig').addEventListener('click', ()=>{
  if(!confirm('¿Restablecer configuración a valores por defecto?')) return;
  CFG = JSON.parse(JSON.stringify(DEFAULT_CFG));
  store.set('cfg', CFG); hydrateConfigForm(); applyEmojiFlag(); hydrateBrand();
  eToast('Configuración restablecida');
});

/* ========= Descarga CSV ========= */
function downloadCSV(rows, filename){
  if(!rows || rows.length===0){ alert('Sin datos'); return; }
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(',')].concat(rows.map(r=> cols.map(c=>{
    const v = r[c]??'';
    return `"${String(v).replace(/"/g,'""')}"`;
  }).join(','))).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

/* ========= Toast simple ========= */
function eToast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style,{
    position:'fixed', bottom:'16px', right:'16px', background:'#0b1223', color:'#fff',
    border:'1px solid rgba(255,255,255,.15)', padding:'10px 14px', borderRadius:'10px',
    boxShadow:'0 8px 20px rgba(0,0,0,.35)', zIndex:9999
  });
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), 1800);
}

/* ========= Accesos rápidos ========= */
window.addEventListener('keydown', (e)=>{
  if(e.ctrlKey && e.key.toLowerCase()==='f'){ e.preventDefault(); $('#buscar').focus(); }
  if(e.ctrlKey && e.key.toLowerCase()==='b'){ e.preventDefault(); $('#cobrarBtn').click(); }
  if(e.key==='Delete'){ e.preventDefault(); $('#vaciarBtn').click(); }
});
