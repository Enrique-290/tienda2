/* ------------ DATOS CON STOCK ------------ */
let inventory = [
  {id:1, name:'Croqueta Premium 3kg (Perro)', price:329.00, cat:'Perros', stock:10},
  {id:2, name:'Croqueta Premium 1.5kg (Gato)', price:219.00, cat:'Gatos', stock:8},
  {id:3, name:'Juguete Pelota Reforzada', price:89.00, cat:'Accesorios', stock:15},
  {id:4, name:'Hueso Nylon Mediano', price:129.00, cat:'Accesorios', stock:6},
  {id:5, name:'Arena Aglomerante 5kg', price:185.00, cat:'Gatos', stock:12},
  {id:6, name:'Shampoo Hipoalergénico 500ml', price:145.00, cat:'Higiene', stock:7}
];

/* ------------ ESTADO ------------ */
let cart = JSON.parse(localStorage.getItem('petpos_cart')||'[]'); // [{id,qty,price,name}]
let sales = JSON.parse(localStorage.getItem('petpos_sales')||'[]'); // historial
const fmt = n => n.toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const q = s => document.querySelector(s);

/* ------------ UI: PRODUCTOS ------------ */
function renderProducts(list = inventory){
  const grid = q('#productGrid'); grid.innerHTML='';
  if(!list.length){ grid.innerHTML = '<div class="muted">Sin resultados…</div>'; return; }
  list.forEach(p=>{
    const el = document.createElement('div');
    el.className='card';
    el.innerHTML = `
      <div class="name">${p.name}</div>
      <div class="muted">${p.cat}</div>
      <div class="price">${fmt(p.price)}</div>
      <div class="stock">Stock: ${p.stock}</div>
      <div style="display:flex;gap:8px;">
        <input type="number" min="1" value="1" style="width:70px">
        <button class="btn">Agregar</button>
      </div>`;
    const qty = el.querySelector('input');
    el.querySelector('button').onclick = ()=>{
      const n = Math.max(1, parseInt(qty.value||1,10));
      if(n > p.stock){ alert('No hay stock suficiente'); return; }
      addToCart(p, n);
    };
    grid.appendChild(el);
  });
}

/* ------------ FILTROS ------------ */
function applyFilters(){
  const term = q('#search').value.toLowerCase().trim();
  const cat = q('#category').value;
  const result = inventory.filter(p=>{
    const okCat = !cat || p.cat === cat;
    const okTxt = !term || p.name.toLowerCase().includes(term);
    return okCat && okTxt;
  });
  renderProducts(result);
}

/* ------------ CARRITO ------------ */
function addToCart(prod, qty){
  const item = cart.find(x=>x.id===prod.id);
  const already = item? item.qty : 0;
  if(qty + already > prod.stock){ alert('No hay stock suficiente'); return; }
  if(item){ item.qty += qty; }
  else { cart.push({id:prod.id,name:prod.name,price:prod.price,qty}); }
  persistCart(); renderCart();
}

function updateQty(id, qty){
  const it = cart.find(x=>x.id===id);
  if(!it) return;
  const prod = inventory.find(p=>p.id===id);
  it.qty = Math.max(1, qty);
  if(it.qty > prod.stock){ it.qty = prod.stock; }
  persistCart(); renderCart();
}

function removeItem(id){ cart = cart.filter(x=>x.id!==id); persistCart(); renderCart(); }
function clearCart(){ cart = []; persistCart(); renderCart(); }
function persistCart(){ localStorage.setItem('petpos_cart', JSON.stringify(cart)); }

function computeTotals(){
  const sub = cart.reduce((a,i)=>a + i.price*i.qty, 0);
  const dVal = parseFloat(q('#discountValue').value||0);
  const dType = q('#discountType').value;
  const discount = dType==='percent' ? (sub * (dVal/100)) : dVal;
  const base = Math.max(0, sub - discount);
  const iva  = base * 0.16;
  const tot  = base + iva;
  const cash = parseFloat(q('#cash').value||0);
  const change = Math.max(0, cash - tot);
  return {sub, discount, base, iva, tot, change};
}

function renderCart(){
  const body = q('#cartBody'); body.innerHTML='';
  if(!cart.length){ body.innerHTML = '<tr><td colspan="6" class="muted">Sin productos</td></tr>'; }
  cart.forEach(i=>{
    const prod = inventory.find(p=>p.id===i.id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i.name}</td>
      <td>${prod.stock}</td>
      <td><input type="number" min="1" value="${i.qty}" style="width:70px"></td>
      <td>${fmt(i.price)}</td>
      <td>${fmt(i.price*i.qty)}</td>
      <td><button class="btn gray" style="background:var(--bad);border-color:var(--bad)">X</button></td>`;
    tr.querySelector('input').onchange = e => updateQty(i.id, parseInt(e.target.value||1,10));
    tr.querySelector('button').onclick = ()=> removeItem(i.id);
    body.appendChild(tr);
  });
  const t = computeTotals();
  q('#subTotal').textContent = fmt(t.sub);
  q('#discountAmount').textContent = '- ' + fmt(t.discount);
  q('#baseAmount').textContent = fmt(t.base);
  q('#tax').textContent = fmt(t.iva);
  q('#grandTotal').textContent = fmt(t.tot);
  q('#change').textContent = fmt(t.change);
  q('#checkout').disabled = cart.length===0;
}

/* ------------ COBRO / TICKET & HISTORIAL ------------ */
function checkout(){
  if(cart.length===0) return;
  const pay = q('#payment').value;
  const customer = q('#customer').value.trim() || 'Público General';
  const t = computeTotals();

  // Validar efectivo si eligió Efectivo
  if(pay==='Efectivo'){
    const cash = parseFloat(q('#cash').value||0);
    if(cash < t.tot){ alert('Efectivo insuficiente'); return; }
  }

  // Actualiza stock
  cart.forEach(i=>{
    const p = inventory.find(x=>x.id===i.id);
    p.stock -= i.qty;
  });

  // Ticket
  const d = new Date();
  const lines = cart.map(i=>`${i.qty} x ${i.name} @ ${fmt(i.price)} = ${fmt(i.price*i.qty)}`).join('\n');
  const ticket = `
PetPOS – Tienda de Mascotas
Fecha: ${d.toLocaleString('es-MX')}
Cliente: ${customer}
--------------------------------
${lines}
--------------------------------
Subtotal:  ${fmt(t.sub)}
Descuento: ${fmt(t.discount)}
Base IVA:  ${fmt(t.base)}
IVA 16%:   ${fmt(t.iva)}
TOTAL:     ${fmt(t.tot)}
Pago:      ${pay}
Cambio:    ${fmt(t.change)}
Gracias por su compra 🐾
  `.trim();

  // Guardar venta en historial
  sales.push({
    date: d.toISOString(),
    customer, pay,
    items: cart.map(i=>({id:i.id,name:i.name,price:i.price,qty:i.qty})),
    totals: t
  });
  localStorage.setItem('petpos_sales', JSON.stringify(sales));

  // Imprimir
  const w = window.open('', '_blank', 'width=380,height=600');
  w.document.write(`<pre style="font:14px/1.25 ui-monospace,monospace;white-space:pre-wrap;margin:12px">${ticket}</pre><script>window.print();</script>`);
  w.document.close();

  // Limpiar carrito y refrescar UI
  clearCart();
  renderProducts(); // para ver stock actualizado
}

/* ------------ CSV HISTORIAL ------------ */
function exportCSV(){
  if(!sales.length){ alert('Sin ventas registradas.'); return; }
  const rows = [['Fecha','Cliente','Pago','Producto','Cantidad','Precio','Subtotal','Total']];
  sales.forEach(s=>{
    const total = s.totals.tot;
    s.items.forEach(i=>{
      rows.push([
        s.date,
        s.customer,
        s.pay,
        i.name,
        i.qty,
        i.price,
        (i.price*i.qty).toFixed(2),
        total.toFixed(2)
      ]);
    });
  });
  const csv = rows.map(r=>r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ventas_petpos_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

/* ------------ EVENTOS ------------ */
document.addEventListener('DOMContentLoaded', ()=>{
  renderProducts();
  renderCart();

  q('#search').addEventListener('input', applyFilters);
  q('#category').addEventListener('change', applyFilters);
  q('#clearFilters').onclick = ()=>{ q('#search').value=''; q('#category').value=''; applyFilters(); };

  q('#clearCart').onclick = clearCart;
  q('#checkout').onclick = checkout;
  q('#exportCSV').onclick = exportCSV;

  // Recalcular totales al cambiar descuentos / efectivo
  ['discountValue','discountType','cash'].forEach(id=>{
    q('#'+id).addEventListener('input', renderCart);
    q('#'+id).addEventListener('change', renderCart);
  });

  // Atajos
  document.addEventListener('keydown', (e)=>{
    if(e.ctrlKey && e.key.toLowerCase()==='f'){ e.preventDefault(); q('#search').focus(); }
    if(e.ctrlKey && e.key.toLowerCase()==='b'){ e.preventDefault(); checkout(); }
    if(e.key==='Delete'){ clearCart(); }
  });
});
