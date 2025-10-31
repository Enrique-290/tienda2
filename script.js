const PRODUCTS = [
  {id:1, name:'Croqueta Premium 3kg (Perro)', price:329.00, cat:'Perros'},
  {id:2, name:'Croqueta Premium 1.5kg (Gato)', price:219.00, cat:'Gatos'},
  {id:3, name:'Juguete Pelota Reforzada', price:89.00, cat:'Accesorios'},
  {id:4, name:'Hueso Nylon Mediano', price:129.00, cat:'Accesorios'},
  {id:5, name:'Arena Aglomerante 5kg', price:185.00, cat:'Gatos'},
  {id:6, name:'Shampoo Hipoalergénico 500ml', price:145.00, cat:'Higiene'}
];

let cart = [];
const fmt = n => n.toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const q = sel => document.querySelector(sel);

function renderProducts(list = PRODUCTS){
  const grid = q('#productGrid'); grid.innerHTML = '';
  if(!list.length){ grid.innerHTML = '<div class="muted">Sin resultados…</div>'; return; }
  list.forEach(p=>{
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div class="name">${p.name}</div>
      <div class="muted">${p.cat}</div>
      <div class="price">${fmt(p.price)}</div>
      <div style="display:flex;gap:8px;">
        <input type="number" min="1" value="1" style="width:60px">
        <button class="btn">Agregar</button>
      </div>`;
    const qty = el.querySelector('input');
    el.querySelector('button').onclick = ()=>addToCart(p,parseInt(qty.value||1));
    grid.appendChild(el);
  });
}

function applyFilters(){
  const term = q('#search').value.toLowerCase();
  const cat = q('#category').value;
  const result = PRODUCTS.filter(p=>{
    const okCat = !cat || p.cat===cat;
    const okTxt = !term || p.name.toLowerCase().includes(term);
    return okCat && okTxt;
  });
  renderProducts(result);
}

function addToCart(prod, qty){
  const i = cart.findIndex(x=>x.id===prod.id);
  if(i>=0){cart[i].qty+=qty;}else{cart.push({...prod,qty});}
  renderCart();
}

function renderCart(){
  const body=q('#cartBody'); body.innerHTML='';
  if(!cart.length){body.innerHTML='<tr><td colspan="5" class="muted">Sin productos</td></tr>';return;}
  cart.forEach(i=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${i.name}</td>
      <td><input type="number" min="1" value="${i.qty}" style="width:60px"></td>
      <td>${fmt(i.price)}</td>
      <td>${fmt(i.price*i.qty)}</td>
      <td><button style="background:#ef4444;color:#fff;border:none;padding:6px 10px;border-radius:8px">X</button></td>`;
    tr.querySelector('input').onchange=e=>{i.qty=parseInt(e.target.value||1);renderCart();}
    tr.querySelector('button').onclick=()=>{cart=cart.filter(x=>x.id!==i.id);renderCart();}
    body.appendChild(tr);
  });
  const sub=cart.reduce((a,i)=>a+i.price*i.qty,0);
  const iva=sub*0.16,tot=sub+iva;
  q('#subTotal').textContent=fmt(sub);
  q('#tax').textContent=fmt(iva);
  q('#grandTotal').textContent=fmt(tot);
}

function clearCart(){cart=[];renderCart();}
function checkout(){
  const pay=q('#payment').value;
  const t=cart.reduce((a,i)=>a+i.price*i.qty,0);
  alert(`Total: ${fmt(t*1.16)}\nPago con: ${pay}\n¡Gracias por su compra!`);
  clearCart();
}

document.addEventListener('DOMContentLoaded',()=>{
  renderProducts();
  q('#search').oninput=applyFilters;
  q('#category').onchange=applyFilters;
  q('#clearFilters').onclick=()=>{q('#search').value='';q('#category').value='';applyFilters();}
  q('#checkout').onclick=checkout;
  q('#clearCart').onclick=clearCart;
});
