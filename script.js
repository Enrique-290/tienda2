/* ====== helpers/estado ====== */
const $ = s=>document.querySelector(s);
const fmt = n => Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const getCSS = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

let settings = JSON.parse(localStorage.getItem('na_settings')||'null') || {
  theme:{bg:getCSS('--bg'),card:getCSS('--card'),menu:getCSS('--menu'),pri:getCSS('--pri'),txt:getCSS('--txt'),muted:getCSS('--muted')},
  ticket:{iva:16,msg:'Gracias por su compra 🐾',logo:'',name:'PetPOS',addr:'',phone:'',email:'',social:''}
};
let inventory = JSON.parse(localStorage.getItem('na_inventory')||'[]');
let clients   = JSON.parse(localStorage.getItem('na_clients')||'[]');
let sales     = JSON.parse(localStorage.getItem('na_sales')||'[]');
let cart      = JSON.parse(localStorage.getItem('na_cart')||'[]');
let editingProduct = null, editingClient=null;

function saveAll(){
  localStorage.setItem('na_settings',JSON.stringify(settings));
  localStorage.setItem('na_inventory',JSON.stringify(inventory));
  localStorage.setItem('na_clients',JSON.stringify(clients));
  localStorage.setItem('na_sales',JSON.stringify(sales));
  localStorage.setItem('na_cart',JSON.stringify(cart));
}
function setTheme(t){
  document.documentElement.style.setProperty('--bg',t.bg);
  document.documentElement.style.setProperty('--card',t.card);
  document.documentElement.style.setProperty('--menu',t.menu);
  document.documentElement.style.setProperty('--pri',t.pri);
  document.documentElement.style.setProperty('--txt',t.txt);
  document.documentElement.style.setProperty('--muted',t.muted);
}
function csvDownload(rows, name){
  const csv = rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download=name; a.click();
}
function todayStr(d=new Date()){return d.toISOString().slice(0,10);}

/* ====== navegación ====== */
document.querySelectorAll('.nav').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    $('#view-'+b.dataset.view).classList.add('active');
    if(b.dataset.view==='dashboard') renderDashboard();
    if(b.dataset.view==='ventas')    renderVentas();
    if(b.dataset.view==='inventario')renderInventario();
    if(b.dataset.view==='clientes')  renderClientes();
    if(b.dataset.view==='historial') renderHistorial();
    if(b.dataset.view==='reportes')  renderReportes();
    if(b.dataset.view==='config')    loadConfigUI();
    if(b.dataset.view==='ticket58')  renderTicketPreview();
  };
});

/* ====== DASHBOARD ====== */
function renderDashboard(){
  const today = todayStr();
  const todaySales = sales.filter(s=>s.date.slice(0,10)===today);
  const total = todaySales.reduce((a,s)=>a+s.totals.tot,0);
  const gan = todaySales.reduce((a,s)=>a+s.items.reduce((x,i)=>x + (i.price-(i.cost||0))*i.qty,0),0);
  $('#kpi-ventas').textContent=fmt(total);
  $('#kpi-tickets').textContent=todaySales.length;
  $('#kpi-stock').textContent=inventory.reduce((a,p)=>a+p.stock,0);
  $('#kpi-ganancia').textContent=fmt(gan);

  const to=new Date(); const from=new Date(); from.setDate(to.getDate()-6);
  $('#dash-from').value=todayStr(from); $('#dash-to').value=todayStr(to);
  drawChart('#chart', aggregateByDay(from,to));
}
$('#dash-apply').onclick=()=>{ drawChart('#chart', aggregateByDay(new Date($('#dash-from').value), new Date($('#dash-to').value))); };
function aggregateByDay(from,to){
  const map={}; const d=new Date(from); while(d<=to){ map[todayStr(d)]=0; d.setDate(d.getDate()+1); }
  sales.forEach(s=>{const k=s.date.slice(0,10); if(map[k]!=null) map[k]+=s.totals.tot;});
  return Object.entries(map);
}
function drawChart(sel,data){
  const c=$(sel), ctx=c.getContext('2d'); const W=c.width=c.clientWidth, H=c.height; ctx.clearRect(0,0,W,H);
  const max=Math.max(...data.map(x=>x[1]),1), pad=24, bw=(W-pad*2)/data.length-6; let x=pad;
  ctx.strokeStyle='#ccc'; ctx.beginPath(); ctx.moveTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
  data.forEach(([lab,val])=>{ const h=(H-pad*2)*(val/max); ctx.fillStyle=getCSS('--pri'); ctx.fillRect(x,H-pad-h,bw,h); ctx.fillStyle='#555'; ctx.font='11px system-ui'; ctx.fillText(lab.slice(5),x,H-6); x+=bw+6;});
}

/* ====== VENTAS ====== */
function renderVentas(){
  // categorías
  const cats=[...new Set(inventory.map(p=>p.cat).filter(Boolean))]; $('#v-cat').innerHTML='<option value="">Todas</option>'+cats.map(c=>`<option>${c}</option>`).join('');
  // clientes lista
  $('#v-customers').innerHTML=clients.map(c=>`<option value="${c.name}">`).join('');
  // grid productos
  const term=($('#v-search').value||'').toLowerCase(); const cat=$('#v-cat').value;
  const min=parseFloat($('#v-min').value||0); const max=parseFloat($('#v-max').value||1e12);
  const grid=$('#v-grid'); grid.innerHTML='';
  inventory.filter(p=>{
    const t=(p.name+' '+p.sku+' '+p.cat+' '+(p.lot||'')+' '+(p.desc||'')).toLowerCase();
    return (!cat||p.cat===cat) && t.includes(term) && p.price>=min && p.price<=max;
  }).forEach(p=>{
    const card=document.createElement('div'); card.className='product';
    card.innerHTML=`
      <img src="${p.img||'https://placehold.co/80x80?text=IMG'}" alt="">
      <div>
        <div class="pname">${p.name}</div>
        <div class="muted">SKU ${p.sku||'-'} · ${p.cat||'-'} · Stock ${p.stock}</div>
        <div class="row between">
          <div><b>${fmt(p.price)}</b></div>
          <div class="row gap">
            <input type="number" min="1" value="1" style="width:72px">
            <button class="btn add">Agregar</button>
          </div>
        </div>
      </div>`;
    card.querySelector('.add').onclick=()=>{
      const qty=parseInt(card.querySelector('input').value||1,10);
      if(qty>p.stock){alert('Sin stock suficiente');return;}
      const f=cart.find(i=>i.id===p.id);
      if(f){ if(f.qty+qty>p.stock){alert('Sin stock suficiente');return;} f.qty+=qty; }
      else cart.push({id:p.id,name:p.name,sku:p.sku,price:p.price,cost:p.cost,qty});
      saveAll(); renderCart();
    };
    grid.appendChild(card);
  });
  renderCart();
}
function renderCart(){
  const tb=$('#v-cart'); tb.innerHTML='';
  if(!cart.length){tb.innerHTML='<tr><td colspan="7" class="muted">Sin productos</td></tr>';}
  cart.forEach(it=>{
    const p=inventory.find(x=>x.id===it.id)||{stock:0};
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${it.name}</td><td>${it.sku||'-'}</td><td>${p.stock}</td>
      <td><input type="number" min="1" value="${it.qty}" style="width:70px"></td>
      <td>${fmt(it.price)}</td><td>${fmt(it.price*it.qty)}</td>
      <td><button class="btn gray rem">X</button></td>`;
    tr.querySelector('input').onchange=e=>{
      let q=parseInt(e.target.value||1,10); if(q>p.stock) q=p.stock; it.qty=q; saveAll(); renderTotals();
    };
    tr.querySelector('.rem').onclick=()=>{ cart=cart.filter(x=>x!==it); saveAll(); renderCart(); };
    tb.appendChild(tr);
  });
  renderTotals();
}
function totals(){
  const sub=cart.reduce((a,i)=>a+i.price*i.qty,0);
  const dVal=parseFloat($('#v-discount').value||0); const dType=$('#v-discount-type').value;
  const disc = dType==='percent' ? (sub*(dVal/100)) : dVal;
  const base=Math.max(0, sub-disc);
  const iva = base*(Number(settings.ticket.iva)/100);
  const tot = base+iva;
  const cash=parseFloat($('#v-cash').value||0);
  const change = $('#v-pay').value==='Efectivo' ? Math.max(0,cash-tot) : 0;
  return {sub,disc,base,iva,tot,change};
}
function renderTotals(){
  const t=totals();
  $('#v-sub').textContent=fmt(t.sub);
  $('#v-disc').textContent='- '+fmt(t.disc);
  $('#v-base').textContent=fmt(t.base);
  $('#v-iva').textContent=fmt(t.iva);
  $('#v-total').textContent=fmt(t.tot);
  $('#v-change').textContent=fmt(t.change);
}
$('#v-clear').onclick=()=>{$('#v-search').value='';$('#v-cat').value='';$('#v-min').value='';$('#v-max').value='';renderVentas();};
['v-search','v-cat','v-min','v-max'].forEach(id=>$('#'+id).addEventListener('input',renderVentas));
$('#v-clear-cart').onclick=()=>{cart=[];saveAll();renderCart();};
$('#v-checkout').onclick=()=>{
  if(!cart.length) return;
  const pay=$('#v-pay').value; const t=totals();
  if(pay==='Efectivo' && parseFloat($('#v-cash').value||0)<t.tot){alert('Efectivo insuficiente');return;}
  const customer=($('#v-customer').value||'Público General').trim();
  // descuenta stock
  cart.forEach(i=>{const p=inventory.find(x=>x.id===i.id); if(p) p.stock-=i.qty;});
  // cliente
  const cli=clients.find(c=>c.name.toLowerCase()===customer.toLowerCase());
  if(cli){ cli.visits=(cli.visits||0)+1; cli.lastPurchase=new Date().toISOString(); }
  // venta
  const recId='T'+Date.now().toString().slice(-8);
  const sale={id:recId,date:new Date().toISOString(),customer,pay,items:cart.map(i=>({...i})),totals:t};
  sales.push(sale); saveAll();
  printTicket(sale);
  // RESET A ESTADO POR DEFECTO
  cart=[]; saveAll(); renderCart();
  $('#v-customer').value=''; $('#v-pay').value='Efectivo'; $('#v-cash').value=''; $('#v-discount').value=''; $('#v-discount-type').value='amount';
  renderDashboard(); renderVentas();
};

/* ====== INVENTARIO (CRUD + subir imagen + agregar stock) ====== */
function renderInventario(){
  const cats=[...new Set(inventory.map(p=>p.cat).filter(Boolean))]; $('#p-cats').innerHTML=cats.map(c=>`<option value="${c}">`).join('');
  const term=($('#p-find').value||'').toLowerCase();
  const tb=$('#p-body'); tb.innerHTML='';
  const list=inventory.filter(p=>(p.name+' '+p.sku+' '+p.cat+' '+(p.lot||'')).toLowerCase().includes(term));
  if(!list.length){tb.innerHTML='<tr><td class="muted" colspan="11">Sin productos</td></tr>';return;}
  list.forEach(p=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${p.img?`<img src="${p.img}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--bd)">`:'—'}</td>
      <td>${p.sku||''}</td><td>${p.name}</td><td>${p.cat||''}</td>
      <td>${fmt(p.price)}</td><td>${fmt(p.cost||0)}</td><td>${p.stock}</td><td>${p.min||0}</td>
      <td>${p.exp||'-'}</td><td>${p.lot||'-'}</td>
      <td class="row gap">
        <button class="btn link e">Editar</button>
        <button class="btn gray s">+ Agregar stock</button>
        <button class="btn gray d" style="background:#ef4444;border-color:#ef4444">Borrar</button>
      </td>`;
    tr.querySelector('.e').onclick=()=>loadProductForm(p.id);
    tr.querySelector('.d').onclick=()=>{ if(confirm('¿Borrar producto?')){ inventory=inventory.filter(x=>x.id!==p.id); saveAll(); renderInventario(); renderVentas(); } };
    tr.querySelector('.s').onclick=()=>{
      const qty=Number(prompt('Cantidad a sumar:', '1'));
      if(!qty || qty<=0) return;
      const lote=prompt('Lote (opcional)', p.lot||'')||p.lot;
      const cad=prompt('Caducidad (YYYY-MM-DD opcional)', p.exp||'')||p.exp;
      p.stock += qty; if(lote) p.lot=lote; if(cad) p.exp=cad; saveAll(); renderInventario(); renderDashboard();
    };
    tb.appendChild(tr);
  });
}
function readProductForm(){
  const cat=$('#p-new-cat').value.trim() || $('#p-cat').value.trim();
  return {
    id: editingProduct || Date.now(),
    sku:$('#p-sku').value.trim(), name:$('#p-name').value.trim(), cat,
    price:parseFloat($('#p-price').value||0), cost:parseFloat($('#p-cost').value||0),
    stock:parseInt($('#p-stock').value||0,10), min:parseInt($('#p-min').value||0,10),
    exp:$('#p-exp').value||'', lot:$('#p-lot').value.trim(),
    img:$('#p-img').value.trim(), desc:$('#p-desc').value.trim()
  };
}
function loadProductForm(id){
  const p=inventory.find(x=>x.id===id); if(!p) return; editingProduct=id;
  $('#p-sku').value=p.sku||''; $('#p-name').value=p.name||''; $('#p-cat').value=p.cat||''; $('#p-new-cat').value='';
  $('#p-price').value=p.price; $('#p-cost').value=p.cost||0; $('#p-stock').value=p.stock; $('#p-min').value=p.min||0;
  $('#p-exp').value=p.exp||''; $('#p-lot').value=p.lot||''; $('#p-img').value=p.img||''; $('#p-desc').value=p.desc||'';
}
$('#p-save').onclick=()=>{
  const p=readProductForm(); if(!p.name){alert('Nombre requerido');return;}
  const i=inventory.findIndex(x=>x.id===p.id); if(i>=0) inventory[i]=p; else inventory.push(p);
  editingProduct=null; clearProdForm(); saveAll(); renderInventario(); renderVentas(); renderDashboard();
};
$('#p-new').onclick=()=>{editingProduct=null; clearProdForm();};
function clearProdForm(){ ['p-sku','p-name','p-cat','p-new-cat','p-price','p-cost','p-stock','p-min','p-exp','p-lot','p-img','p-desc'].forEach(id=>$('#'+id).value=''); }
$('#p-find').addEventListener('input', renderInventario);
$('#p-export').onclick=()=>{
  const rows=[['SKU','Nombre','Categoría','Precio','Costo','Stock','Mínimo','Caducidad','Lote','Descripción','Imagen']];
  inventory.forEach(p=>rows.push([p.sku,p.name,p.cat,p.price,p.cost,p.stock,p.min,p.exp,p.lot,p.desc,p.img]));
  csvDownload(rows,'inventario.csv');
};
/* Cargar imagen de producto desde dispositivo (convierte a base64 y la pone en p-img) */
$('#p-img-file').addEventListener('change', async (e)=>{
  const file=e.target.files?.[0]; if(!file) return;
  const data = await fileToDataURL(file, 512, 512); // redimensiona
  $('#p-img').value=data; // guardamos base64 en el campo
});

/* ====== CLIENTES ====== */
function renderClientes(){
  const term=($('#c-find').value||'').toLowerCase();
  const tb=$('#c-body'); tb.innerHTML='';
  const list=clients.filter(c=>(c.name+' '+(c.phone||'')+' '+(c.email||'')).toLowerCase().includes(term));
  if(!list.length){tb.innerHTML='<tr><td colspan="6" class="muted">Sin clientes</td></tr>';return;}
  list.forEach(c=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${c.name}</td><td>${c.phone||''}</td><td>${c.email||''}</td>
      <td>${c.visits||0}</td><td>${c.lastPurchase?new Date(c.lastPurchase).toLocaleString('es-MX'):'-'}</td>
      <td><button class="btn link e">Editar</button><button class="btn gray d" style="background:#ef4444;border-color:#ef4444">Borrar</button></td>`;
    tr.querySelector('.e').onclick=()=>{editingClient=c.id; $('#c-name').value=c.name; $('#c-phone').value=c.phone||''; $('#c-email').value=c.email||''; $('#c-notes').value=c.notes||'';};
    tr.querySelector('.d').onclick=()=>{ if(confirm('¿Eliminar cliente?')){ clients=clients.filter(x=>x.id!==c.id); saveAll(); renderClientes(); }};
    tb.appendChild(tr);
  });
  $('#v-customers').innerHTML=clients.map(c=>`<option value="${c.name}">`).join('');
}
$('#c-save').onclick=()=>{
  const name=$('#c-name').value.trim(); if(!name){alert('Nombre requerido');return;}
  const data={id: editingClient||Date.now(), name, phone:$('#c-phone').value.trim(), email:$('#c-email').value.trim(), notes:$('#c-notes').value.trim(), visits:0, lastPurchase:null};
  const i=clients.findIndex(x=>x.id===data.id); if(i>=0) clients[i]=data; else clients.push(data);
  editingClient=null; ['c-name','c-phone','c-email','c-notes'].forEach(id=>$('#'+id).value=''); saveAll(); renderClientes();
};
$('#c-new').onclick=()=>{editingClient=null; ['c-name','c-phone','c-email','c-notes'].forEach(id=>$('#'+id).value='');};
$('#c-find').addEventListener('input', renderClientes);
$('#c-export').onclick=()=>{
  const rows=[['Nombre','Teléfono','Email','Visitas','Última compra','Notas']];
  clients.forEach(c=>rows.push([c.name,c.phone||'',c.email||'',c.visits||0,c.lastPurchase||'',c.notes||'']));
  csvDownload(rows,'clientes.csv');
};

/* ====== HISTORIAL ====== */
function renderHistorial(){
  const tb=$('#h-body'); tb.innerHTML='';
  const f=$('#h-from').value, t=$('#h-to').value, term=($('#h-find').value||'').toLowerCase();
  const list=sales.filter(s=>{
    const okDate = (!f||s.date>=f) && (!t||s.date<=t+'T23:59:59');
    const str=(s.customer+' '+s.id).toLowerCase();
    return okDate && str.includes(term);
  }).sort((a,b)=>b.date.localeCompare(a.date));
  if(!list.length){tb.innerHTML='<tr><td colspan="5" class="muted">Sin ventas</td></tr>';return;}
  list.forEach(s=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${new Date(s.date).toLocaleString('es-MX')}</td><td>${s.customer}</td><td>${s.pay}</td><td>${fmt(s.totals.tot)}</td>
      <td class="row gap">
        <button class="btn link r">Reimprimir</button>
        <button class="btn gray c" style="background:#ef4444;border-color:#ef4444">Cancelar</button>
      </td>`;
    tr.querySelector('.r').onclick=()=>printTicket(s);
    tr.querySelector('.c').onclick=()=>{
      if(!confirm('¿Cancelar venta y regresar stock?')) return;
      s.items.forEach(i=>{ const p=inventory.find(x=>x.id===i.id); if(p) p.stock+=i.qty; });
      sales=sales.filter(x=>x!==s); saveAll(); renderHistorial(); renderVentas(); renderDashboard();
    };
    tb.appendChild(tr);
  });
}
['h-from','h-to','h-find'].forEach(id=>$('#'+id).addEventListener('input',renderHistorial));
$('#h-export').onclick=()=>{
  const rows=[['Fecha','Ticket','Cliente','Pago','Producto','Cant','Precio','Subtotal','Total']];
  sales.forEach(s=>s.items.forEach(i=>rows.push([s.date,s.id,s.customer,s.pay,i.name,i.qty,i.price,(i.qty*i.price).toFixed(2),s.totals.tot.toFixed(2)])));
  csvDownload(rows,'ventas.csv');
};

/* ====== REPORTES (detallado + resumen + respaldo) ====== */
function renderReportes(){
  const to=new Date(); const from=new Date(); from.setDate(to.getDate()-6);
  $('#r-from').value=todayStr(from); $('#r-to').value=todayStr(to);
  applyReport();
}
function applyReport(){
  const from=new Date($('#r-from').value), to=new Date($('#r-to').value);
  const inRange = s => new Date(s.date)>=from && new Date(s.date)<=new Date(to.toISOString().slice(0,10)+'T23:59:59');
  const list=sales.filter(inRange);
  const ventas=list.reduce((a,s)=>a+s.totals.tot,0);
  const gan=list.reduce((a,s)=>a+s.items.reduce((x,i)=>x+((i.price-(i.cost||0))*i.qty),0),0);
  $('#r-ventas').textContent=fmt(ventas); $('#r-gan').textContent=fmt(gan); $('#r-ticks').textContent=list.length;
  const count={}; list.forEach(s=>s.items.forEach(i=>count[i.name]=(count[i.name]||0)+i.qty));
  const top=Object.entries(count).sort((a,b)=>b[1]-a[1])[0]; $('#r-top').textContent=top?`${top[0]} (${top[1]})`:'—';
  drawChart('#report-chart', aggregateByDay(from,to));
}
$('#r-apply').onclick=applyReport;

$('#r-export-detailed').onclick=()=>{
  const from=new Date($('#r-from').value), to=new Date($('#r-to').value);
  const inRange = s => new Date(s.date)>=from && new Date(s.date)<=new Date(to.toISOString().slice(0,10)+'T23:59:59');
  const list=sales.filter(inRange);
  const rows=[['Fecha','Ticket','Cliente','Pago','SKU','Producto','Categoría','Cantidad','PrecioUnit','SubtotalLinea','CostoUnit','UtilidadLinea','DescuentoVenta','IVA','TotalTicket']];
  list.forEach(s=>{
    s.items.forEach(i=>{
      const prod=inventory.find(p=>p.id===i.id)||{};
      const sub=i.qty*i.price; const util=(i.price-(i.cost||0))*i.qty;
      rows.push([s.date,s.id,s.customer,s.pay,i.sku||prod.sku||'',i.name,prod.cat||'',i.qty,i.price,sub,(i.cost||0),util,s.totals.disc||0,s.totals.iva||0,s.totals.tot||0]);
    });
  });
  csvDownload(rows,'reporte_detallado.csv');
};
$('#r-export-summary').onclick=()=>{
  const from=new Date($('#r-from').value), to=new Date($('#r-to').value);
  const inRange = s => new Date(s.date)>=from && new Date(s.date)<=new Date(to.toISOString().slice(0,10)+'T23:59:59');
  const list=sales.filter(inRange);
  const rows=[['Fecha','Ticket','Cliente','Pago','Items','Base','IVA','Total']];
  list.forEach(s=>rows.push([s.date,s.id,s.customer,s.pay,s.items.reduce((a,i)=>a+i.qty,0),(s.totals?.base||0),(s.totals?.iva||0),s.totals.tot]));
  csvDownload(rows,'reporte_resumen.csv');
};
/* Respaldo (export/import) */
$('#r-backup').onclick=()=>{
  const data={settings, inventory, clients, sales, version:'petpos-v2'};
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.download='petpos_backup.json'; a.click();
};
$('#r-restore').addEventListener('change', async e=>{
  const file=e.target.files?.[0]; if(!file) return;
  const txt=await file.text(); const data=JSON.parse(txt);
  if(!data || !data.inventory || !data.sales){ alert('Respaldo inválido'); return; }
  if(confirm('¿Reemplazar TODO el contenido con el respaldo?')) {
    settings=data.settings||settings; inventory=data.inventory||[]; clients=data.clients||[]; sales=data.sales||[];
    saveAll(); alert('Respaldo importado'); renderDashboard(); renderVentas(); renderInventario(); renderClientes(); renderHistorial(); renderReportes(); loadConfigUI();
  }
});

/* ====== CONFIG ====== */
function rgbToHex(c){const ctx=document.createElement('canvas').getContext('2d');ctx.fillStyle=c;return rgbToHex2(ctx.fillStyle);}
function rgbToHex2(rgb){const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb); if(!m) return rgb; return '#'+[m[1],m[2],m[3]].map(x=>('0'+parseInt(x).toString(16)).slice(-2)).join('');}
function loadConfigUI(){
  $('#cfg-bg').value=rgbToHex(settings.theme.bg);
  $('#cfg-card').value=rgbToHex(settings.theme.card);
  $('#cfg-menu').value=rgbToHex(settings.theme.menu);
  $('#cfg-pri').value=rgbToHex(settings.theme.pri);
  $('#cfg-txt').value=rgbToHex(settings.theme.txt);
  $('#cfg-muted').value=rgbToHex(settings.theme.muted);
  $('#cfg-iva').value=settings.ticket.iva;
  $('#cfg-msg').value=settings.ticket.msg;
  $('#cfg-logo').value=settings.ticket.logo;
  $('#cfg-name').value=settings.ticket.name;
  $('#cfg-addr').value=settings.ticket.addr;
  $('#cfg-phone').value=settings.ticket.phone;
  $('#cfg-email').value=settings.ticket.email;
  $('#cfg-social').value=settings.ticket.social;
  // previews y brand
  const brand = settings.ticket.logo || '';
  $('#previewLogoMenu').src = brand || '';
  $('#previewLogoTicket').src = brand || '';
  $('#brandLogo').src = brand || '';
  $('#brandName').textContent = settings.ticket.name || 'PetPOS';
}
$('#cfg-save').onclick=()=>{
  settings.theme={bg:$('#cfg-bg').value,card:$('#cfg-card').value,menu:$('#cfg-menu').value,pri:$('#cfg-pri').value,txt:$('#cfg-txt').value,muted:$('#cfg-muted').value};
  setTheme(settings.theme); saveAll();
};
$('#cfg-reset').onclick=()=>{settings.theme={bg:'#f6f7fb',card:'#ffffff',menu:'#0f172a',pri:'#2563eb',txt:'#0b1220',muted:'#6b7280'}; setTheme(settings.theme); saveAll(); loadConfigUI();};
$('#cfg-ticket-save').onclick=()=>{
  settings.ticket={iva:Number($('#cfg-iva').value||16),msg:$('#cfg-msg').value,logo:$('#cfg-logo').value,name:$('#cfg-name').value,addr:$('#cfg-addr').value,phone:$('#cfg-phone').value,email:$('#cfg-email').value,social:$('#cfg-social').value};
  saveAll(); loadConfigUI(); renderTicketPreview();
};
/* subir logo desde dispositivo → redimensiona (menú y ticket) y guarda base64 */
$('#cfg-logo-file').addEventListener('change', async e=>{
  const file=e.target.files?.[0]; if(!file) return;
  const base = await fileToDataURL(file, 512, 512); // base grande
  settings.ticket.logo = base; saveAll(); loadConfigUI(); renderTicketPreview();
});

/* ====== Ticket ====== */
function ticketText(sale){
  const t=settings.ticket;
  const lines=sale.items.map(i=>`${i.qty} x ${i.name} (${i.sku||'-'}) @ ${fmt(i.price)} = ${fmt(i.price*i.qty)}`).join('\n');
  return `${t.name}
${t.addr}
Tel: ${t.phone}  ${t.email}
${t.social}
------------------------------
Fecha: ${new Date(sale.date).toLocaleString('es-MX')}
Ticket: ${sale.id}
Cliente: ${sale.customer}
Pago: ${sale.pay}
------------------------------
${lines}
------------------------------
Subtotal:  ${fmt(sale.totals.base)}
IVA ${settings.ticket.iva}%: ${fmt(sale.totals.iva)}
TOTAL:     ${fmt(sale.totals.tot)}
Cambio:    ${fmt(sale.totals.change)}
${t.msg}`;
}
function renderTicketPreview(){
  const s = sales[sales.length-1] || {id:'DEMO',date:new Date().toISOString(),customer:'Público General',pay:'Efectivo',items:[{name:'Croqueta',sku:'SKU1',price:100,qty:1}],totals:{base:100,iva:16,tot:116,change:0}};
  $('#ticket-preview').textContent = ticketText(s);
}
function printTicket(sale){
  renderTicketPreview();
  const txt=ticketText(sale);
  const w=window.open('','_blank','width=360,height=600');
  const logo = settings.ticket.logo ? `<img src="${settings.ticket.logo}" style="max-width:220px;height:auto;object-fit:contain" />` : '';
  w.document.write(`<div style="font:14px/1.25 ui-monospace,monospace;margin:10px;white-space:pre-wrap">
    ${logo?logo+'<br/>':''}<pre>${txt}</pre></div><script>window.print()</script>`);
  w.document.close();
}
$('#t-print').onclick=()=>{ const s=sales[sales.length-1]; if(s) printTicket(s); };

/* ====== utils: imagen a dataURL con resize ====== */
async function fileToDataURL(file, maxW=512, maxH=512){
  const img = new Image(); const url = URL.createObjectURL(file);
  await new Promise(res=>{ img.onload=()=>res(); img.src=url; });
  const w=img.width, h=img.height; let nw=w, nh=h;
  const r=Math.min(maxW/w, maxH/h, 1); nw=Math.round(w*r); nh=Math.round(h*r);
  const c=document.createElement('canvas'); c.width=nw; c.height=nh;
  const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,nw,nh);
  URL.revokeObjectURL(url);
  return c.toDataURL('image/webp', 0.85);
}

/* ====== init/seed ====== */
function seedIfEmpty(){
  if(!inventory.length){
    inventory = [
      {id:1, sku:'PER-001', name:'Croqueta Premium 3kg (Perro)', cat:'Perros', price:329, cost:240, stock:10, min:2, exp:'', lot:'L-001', img:'', desc:''},
      {id:2, sku:'GAT-001', name:'Croqueta Premium 1.5kg (Gato)', cat:'Gatos', price:219, cost:160, stock:8, min:2, exp:'', lot:'L-002', img:'', desc:''},
      {id:3, sku:'ACC-010', name:'Juguete Pelota Reforzada', cat:'Accesorios', price:89, cost:35, stock:15, min:5, exp:'', lot:'', img:'', desc:''}
    ];
  }
  if(!clients.length){ clients=[{id:1,name:'Público General',visits:0}]; }
  saveAll();
}
function boot(){
  seedIfEmpty(); setTheme(settings.theme); loadConfigUI();
  document.querySelector('.nav[data-view="dashboard"]').click();
  ['v-discount','v-discount-type','v-cash'].forEach(id=>$('#'+id).addEventListener('input',renderTotals));
}
boot();
