import { useEffect, useState } from 'react'
import { BookOpen, Search, ShoppingBag, Menu, X, Star, ArrowRight, Plus, Minus, Trash2, CheckCircle2, UserRound, LogOut, Pencil, LayoutDashboard, Package, Users, ClipboardList } from 'lucide-react'

type Book={id:number;title:string;author:string;category:string;price:number;rating:number;description:string;cover:string;stock:number}
type User={id:number;name:string;email:string;role:string}
type BookForm={title:string;author:string;category:string;price:string;rating:string;description:string;cover:string;stock:string}
type CartItem={book:Book;quantity:number}
const money=(n:number)=>`$${n.toFixed(2)}`
const blank:BookForm={title:'',author:'',category:'Fiction',price:'',rating:'4.5',description:'',cover:'https://covers.openlibrary.org/b/isbn/9780061122415-L.jpg',stock:'10'}

export default function App(){
 const [books,setBooks]=useState<Book[]>([]),[categories,setCategories]=useState<string[]>(['All'])
 const [category,setCategory]=useState('All'),[search,setSearch]=useState(''),[sort,setSort]=useState('featured')
 const [cart,setCart]=useState<CartItem[]>([]),[cartOpen,setCartOpen]=useState(false),[mobileOpen,setMobileOpen]=useState(false)
 const [notice,setNotice]=useState(''),[loading,setLoading]=useState(true)
 const [token,setToken]=useState(localStorage.getItem('bookhaven_token')||''),[user,setUser]=useState<User|null>(null)
 const [authOpen,setAuthOpen]=useState(false),[authMode,setAuthMode]=useState<'login'|'register'>('login')
 const [authRole,setAuthRole]=useState<'customer'|'admin'>('customer'),[authData,setAuthData]=useState({name:'',email:'',password:''})
 const [adminMode,setAdminMode]=useState(false),[stats,setStats]=useState({books:0,orders:0,customers:0,low_stock:0})
 const [editing,setEditing]=useState<number|null>(null),[bookForm,setBookForm]=useState<BookForm>(blank),[formOpen,setFormOpen]=useState(false)
 const [orderResult,setOrderResult]=useState<{order_id:number,total:number}|null>(null)
 const [checkoutOpen,setCheckoutOpen]=useState(false),[customer,setCustomer]=useState({name:'',email:'',address:''})
 const count=cart.reduce((s,i)=>s+i.quantity,0),subtotal=cart.reduce((s,i)=>s+i.book.price*i.quantity,0)
 const headers=()=>({Authorization:`Bearer ${token}`,'Content-Type':'application/json'})
 function toast(s:string){setNotice(s);setTimeout(()=>setNotice(''),3000)}
 async function loadBooks(){
  setLoading(true);try{const p=new URLSearchParams();if(search.trim())p.set('search',search.trim());if(category!=='All')p.set('category',category);p.set('sort',sort)
   const [b,c]=await Promise.all([fetch(`/api/books?${p}`),fetch('/api/categories')]);if(!b.ok||!c.ok)throw Error()
   setBooks(await b.json());setCategories(await c.json())
  }catch{toast('Could not connect to API. Please start FastAPI.')}finally{setLoading(false)}
 }
 async function loadStats(){try{const r=await fetch('/api/admin/stats',{headers:headers()});if(r.ok)setStats(await r.json())}catch{}}
 useEffect(()=>{const t=setTimeout(loadBooks,180);return()=>clearTimeout(t)},[search,category,sort])
 useEffect(()=>{if(token){fetch('/api/auth/me',{headers:headers()}).then(r=>r.ok?r.json():null).then((u)=>{if(u)setUser(u);else{setToken('');localStorage.removeItem('bookhaven_token')}}).catch(()=>{})}},[])
 useEffect(()=>{if(user?.role==='admin'&&adminMode)loadStats()},[user,adminMode])
 async function submitAuth(e:React.FormEvent){
  e.preventDefault()
  try{
   const endpoint=authMode==='register'?'/api/auth/register':'/api/auth/login'
   const body=authMode==='register'?authData:{email:authData.email,password:authData.password}
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
   const data=await r.json();if(!r.ok)throw Error(data.detail||'Authentication failed')
   if(authRole==='admin'&&data.user.role!=='admin')throw Error('This account is not an administrator.')
   if(authRole==='customer'&&data.user.role==='admin')throw Error('Please use the Admin login option.')
   setToken(data.token);localStorage.setItem('bookhaven_token',data.token);setUser(data.user);setAuthOpen(false);setAuthData({name:'',email:'',password:''})
   if(data.user.role==='admin')setAdminMode(true);toast(`Welcome${data.user.name?`, ${data.user.name}`:''}!`)
  }catch(err){toast(err instanceof Error?err.message:'Login failed')}
 }
 function logout(){setToken('');localStorage.removeItem('bookhaven_token');setUser(null);setAdminMode(false);setAuthOpen(false);toast('You have been logged out')}
 function add(book:Book){setCart(old=>old.some(i=>i.book.id===book.id)?old.map(i=>i.book.id===book.id?{...i,quantity:Math.min(i.quantity+1,book.stock)}:i):[...old,{book,quantity:1}]);toast(`${book.title} added to your bag`)}
 function changeQty(id:number,d:number){setCart(old=>old.map(i=>i.book.id===id?{...i,quantity:i.quantity+d}:i).filter(i=>i.quantity>0))}
 async function placeOrder(e:React.FormEvent){
  e.preventDefault();try{const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_name:customer.name,email:customer.email,address:customer.address,items:cart.map(i=>({book_id:i.book.id,quantity:i.quantity}))})});const d=await r.json();if(!r.ok)throw Error(d.detail||'Checkout failed');setOrderResult({order_id:d.order_id,total:d.total});setCart([]);setCheckoutOpen(false);setCartOpen(false);loadBooks()}catch(err){toast(err instanceof Error?err.message:'Checkout failed')}
 }
 function openNew(){setEditing(null);setBookForm(blank);setFormOpen(true)}
 function openEdit(b:Book){setEditing(b.id);setBookForm({title:b.title,author:b.author,category:b.category,price:String(b.price),rating:String(b.rating),description:b.description,cover:b.cover,stock:String(b.stock)});setFormOpen(true)}
 async function saveBook(e:React.FormEvent){
  e.preventDefault();try{const payload={...bookForm,price:Number(bookForm.price),rating:Number(bookForm.rating),stock:Number(bookForm.stock)}
   const r=await fetch(editing?`/api/admin/books/${editing}`:'/api/admin/books',{method:editing?'PUT':'POST',headers:headers(),body:JSON.stringify(payload)})
   const d=await r.json();if(!r.ok)throw Error(d.detail||'Could not save book')
   setFormOpen(false);toast(editing?'Book updated successfully':'Book added successfully');loadBooks();loadStats()
  }catch(err){toast(err instanceof Error?err.message:'Save failed')}
 }
 async function deleteBook(b:Book){if(!confirm(`Delete "${b.title}"? This cannot be undone.`))return;try{const r=await fetch(`/api/admin/books/${b.id}`,{method:'DELETE',headers:headers()});const d=await r.json();if(!r.ok)throw Error(d.detail);toast('Book deleted');loadBooks();loadStats()}catch(err){toast(err instanceof Error?err.message:'Delete failed')}}

 return <div className="site-shell">
  <div className="announcement">A little more reading, a lot more living. <span>Free shipping on orders over $50</span></div>
  <header className="header">
   <a className="brand" href="#" onClick={()=>setAdminMode(false)}><span className="brand-icon"><BookOpen size={21}/></span><span>book<span className="brand-light">haven</span><small>YOUR NEXT CHAPTER STARTS HERE</small></span></a>
   <nav className={mobileOpen?'nav nav-open':'nav'}><a href="#home" onClick={()=>{setAdminMode(false);setMobileOpen(false)}}>Home</a><a href="#collection" onClick={()=>{setAdminMode(false);setMobileOpen(false)}}>Books</a>{user?.role==='admin'&&<a href="#admin" onClick={()=>{setAdminMode(true);setMobileOpen(false)}}>Dashboard</a>}</nav>
   <div className="header-actions"><label className="header-search"><Search size={17}/><input value={search} onChange={e=>{setSearch(e.target.value);setCategory('All');setAdminMode(false)}} placeholder="Search books..."/></label>
    {!adminMode&&<button className="bag-button" onClick={()=>setCartOpen(true)}><ShoppingBag size={20}/><span>Bag</span><b>{count}</b></button>}
    {user?<><button className="account-button" onClick={()=>user.role==='admin'?setAdminMode(!adminMode):toast(`Signed in as ${user.name}`)}><UserRound size={17}/><span>{user.role==='admin'?'Admin':user.name.split(' ')[0]}</span></button><button className="logout-button" title="Log out" onClick={logout}><LogOut size={17}/></button></>:<button className="account-button" onClick={()=>{setAuthRole('customer');setAuthMode('login');setAuthOpen(true)}}><UserRound size={17}/><span>Sign in</span></button>}
    <button className="mobile-menu" onClick={()=>setMobileOpen(!mobileOpen)}>{mobileOpen?<X/>:<Menu/>}</button>
   </div>
  </header>

  {adminMode&&user?.role==='admin'?<main className="admin-page" id="admin">
   <div className="admin-title"><div><div className="eyebrow"><LayoutDashboard size={14}/> STORE MANAGEMENT</div><h1>Admin <em>dashboard.</em></h1><p>Welcome back, {user.name}. Manage your bookstore catalogue here.</p></div><button className="primary-button" onClick={openNew}><Plus size={17}/> Add a new book</button></div>
   <div className="stats-grid"><div className="stat-card"><BookOpen/><span>Total books</span><strong>{stats.books}</strong></div><div className="stat-card"><ClipboardList/><span>Orders received</span><strong>{stats.orders}</strong></div><div className="stat-card"><Users/><span>Registered customers</span><strong>{stats.customers}</strong></div><div className="stat-card"><Package/><span>Low stock items</span><strong>{stats.low_stock}</strong></div></div>
   <div className="admin-table-head"><div><h2>Book inventory</h2><p>Add, update, or remove books from your store.</p></div><span>{books.length} displayed</span></div>
   <div className="inventory-wrap"><table className="inventory"><thead><tr><th>Book</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>{books.map(b=><tr key={b.id}><td><div className="inventory-book"><img src={b.cover} alt=""/><div><strong>{b.title}</strong><small>{b.author}</small></div></div></td><td>{b.category}</td><td>{money(b.price)}</td><td><span className={b.stock<5?'stock-low':'stock-ok'}>{b.stock}</span></td><td><div className="table-actions"><button onClick={()=>openEdit(b)}><Pencil size={15}/> Edit</button><button className="delete-action" onClick={()=>deleteBook(b)}><Trash2 size={15}/> Delete</button></div></td></tr>)}</tbody></table>{books.length===0&&<div className="empty-state">No books match this search.</div>}</div>
   <p className="admin-hint">Tip: use the search field above to find a book quickly. Changes are saved to your database.</p>
  </main>:<>
   <main>
    <section className="hero" id="home"><div className="hero-copy"><div className="eyebrow">✳ THE BOOK LOVER'S CORNER</div><h1>Find your next<br/><em>great read.</em></h1><p>Stories that stay with you. Ideas that move you. A thoughtfully curated collection for every kind of curious mind.</p><a className="primary-button" href="#collection">Explore the collection <ArrowRight size={17}/></a><div className="hero-note"><div className="avatar-stack"><i>J</i><i>M</i><i>A</i></div><span>Loved by readers in 30+ countries</span></div></div>
     <div className="hero-art"><div className="sun-shape"></div><div className="hero-book hero-book-one"><img src="https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg" alt="Atomic Habits"/></div><div className="hero-book hero-book-two"><img src="https://covers.openlibrary.org/b/isbn/9780061122415-L.jpg" alt="The Alchemist"/></div><div className="hero-book hero-book-three"><img src="https://covers.openlibrary.org/b/isbn/9780143130727-L.jpg" alt="Ikigai"/></div><div className="art-caption">A world between<br/>the pages ✳</div></div>
    </section>
    <section className="trust-strip"><div><strong>01</strong><span>Curated with care</span></div><div><strong>02</strong><span>Readers come first</span></div><div><strong>03</strong><span>Stories for everyone</span></div><div><strong>04</strong><span>Delivered to your door</span></div></section>
    <section className="collection section-wrap" id="collection"><div className="section-heading"><div><div className="eyebrow">THE GOOD STUFF</div><h2>Books worth <em>keeping.</em></h2><p>Handpicked reads for wherever life takes you.</p></div><div className="sort-wrap"><span>Sort by</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Featured</option><option value="rating">Top rated</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></div></div>
     <div className="category-row">{categories.map(c=><button key={c} className={category===c?'category active':'category'} onClick={()=>setCategory(c)}>{c}</button>)}</div>
     {loading?<div className="loading">Finding your next favorite...</div>:books.length===0?<div className="empty-state">No books found. Try another search.</div>:<div className="book-grid">{books.map(b=><article className="book-card" key={b.id}><div className="cover-wrap"><img src={b.cover} alt={`${b.title} cover`} onError={e=>{e.currentTarget.src='https://placehold.co/300x420/e9e4d9/514c40?text=Book+Cover'}}/><span className="cover-tag">{b.category}</span><button className="quick-add" onClick={()=>add(b)}><Plus size={18}/></button></div><div className="book-meta"><div className="rating"><Star size={13} fill="currentColor"/>{b.rating.toFixed(1)}</div><span>{b.stock>0?`${b.stock} in stock`:'Out of stock'}</span></div><h3>{b.title}</h3><p className="author">by {b.author}</p><div className="card-bottom"><strong>{money(b.price)}</strong><button onClick={()=>add(b)} disabled={b.stock===0}>Add to bag</button></div></article>)}</div>}
    </section>
    <section className="quote-band"><div className="quote-mark">“</div><blockquote>A book is a little pocket of possibility. Open one, and go somewhere new.</blockquote><span>THE BOOKHAVEN PROMISE</span></section>
    <section className="newsletter"><div><div className="eyebrow">A NOTE FROM US</div><h2>Good reads. <em>Good news.</em></h2><p>Join our little reading community for new arrivals and bookish recommendations.</p></div><form onSubmit={e=>{e.preventDefault();toast('Thanks for joining the BookHaven community!')}}><input type="email" required placeholder="Your email address"/><button className="primary-button">Count me in <ArrowRight size={16}/></button></form></section>
   </main>
  </>}
  <footer><a className="brand footer-brand" href="#"><span className="brand-icon"><BookOpen size={20}/></span><span>book<span className="brand-light">haven</span><small>YOUR NEXT CHAPTER STARTS HERE</small></span></a><span>© 2026 BookHaven. Made for the love of reading.</span><a href="#">Back to top ↑</a></footer>
  {notice&&<div className="toast">{notice}</div>}
  {authOpen&&<div className="overlay"><div className="modal"><div className="modal-head"><div><span className="eyebrow">{authRole==='admin'?'STORE MANAGEMENT':'WELCOME TO BOOKHAVEN'}</span><h2>{authMode==='login'?'Sign in':'Create account'}</h2></div><button className="icon-button" onClick={()=>setAuthOpen(false)}><X/></button></div>
   <div className="auth-tabs"><button className={authRole==='customer'?'selected':''} onClick={()=>{setAuthRole('customer');setAuthMode('login')}}>Customer</button><button className={authRole==='admin'?'selected':''} onClick={()=>{setAuthRole('admin');setAuthMode('login')}}>Admin</button></div>
   <form className="checkout-form" onSubmit={submitAuth}>{authMode==='register'&&<label>Full name<input required minLength={2} value={authData.name} onChange={e=>setAuthData({...authData,name:e.target.value})} placeholder="Your name"/></label>}<label>Email address<input type="email" required value={authData.email} onChange={e=>setAuthData({...authData,email:e.target.value})} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength={8} value={authData.password} onChange={e=>setAuthData({...authData,password:e.target.value})} placeholder="At least 8 characters"/></label><button className="primary-button checkout-button">{authMode==='login'?'Sign in':'Create account'} <ArrowRight size={16}/></button></form>
   {authRole==='customer'&&<p className="auth-switch">{authMode==='login'?"New to BookHaven?":"Already have an account?"} <button onClick={()=>setAuthMode(authMode==='login'?'register':'login')}>{authMode==='login'?'Create an account':'Sign in'}</button></p>}
   {authRole==='admin'&&<p className="demo-note">Admin access is restricted to the configured administrator account.</p>}
  </div></div>}
  {formOpen&&<div className="overlay"><div className="modal admin-modal"><div className="modal-head"><div><span className="eyebrow">CATALOGUE MANAGEMENT</span><h2>{editing?'Edit book':'Add a book'}</h2></div><button className="icon-button" onClick={()=>setFormOpen(false)}><X/></button></div><form className="checkout-form book-form" onSubmit={saveBook}>
   <div className="form-two"><label>Book title<input required value={bookForm.title} onChange={e=>setBookForm({...bookForm,title:e.target.value})}/></label><label>Author<input required value={bookForm.author} onChange={e=>setBookForm({...bookForm,author:e.target.value})}/></label></div>
   <div className="form-two"><label>Category<input required value={bookForm.category} onChange={e=>setBookForm({...bookForm,category:e.target.value})}/></label><label>Price (USD)<input required type="number" min="0.01" step="0.01" value={bookForm.price} onChange={e=>setBookForm({...bookForm,price:e.target.value})}/></label></div>
   <div className="form-two"><label>Rating (0–5)<input type="number" min="0" max="5" step="0.1" value={bookForm.rating} onChange={e=>setBookForm({...bookForm,rating:e.target.value})}/></label><label>Stock quantity<input type="number" min="0" value={bookForm.stock} onChange={e=>setBookForm({...bookForm,stock:e.target.value})}/></label></div>
   <label>Cover image URL<input required value={bookForm.cover} onChange={e=>setBookForm({...bookForm,cover:e.target.value})}/></label><label>Description<textarea required value={bookForm.description} onChange={e=>setBookForm({...bookForm,description:e.target.value})}/></label>
   <button className="primary-button checkout-button">{editing?'Save changes':'Add book to store'} <ArrowRight size={16}/></button>
  </form></div></div>}
  {cartOpen&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setCartOpen(false)}}><aside className="drawer"><div className="drawer-head"><div><span className="eyebrow">YOUR LITTLE BOOK PILE</span><h2>Shopping bag <small>({count})</small></h2></div><button className="icon-button" onClick={()=>setCartOpen(false)}><X/></button></div>
   {cart.length===0?<div className="drawer-empty"><ShoppingBag size={35}/><h3>Your bag is waiting.</h3><p>Find a story that speaks to you.</p><button className="primary-button" onClick={()=>setCartOpen(false)}>Browse books</button></div>:<><div className="cart-list">{cart.map(i=><div className="cart-line" key={i.book.id}><img src={i.book.cover} alt=""/><div className="cart-info"><strong>{i.book.title}</strong><span>{money(i.book.price)}</span><div className="qty"><button onClick={()=>changeQty(i.book.id,-1)}><Minus size={13}/></button><span>{i.quantity}</span><button onClick={()=>changeQty(i.book.id,1)}><Plus size={13}/></button><button className="remove" onClick={()=>setCart(old=>old.filter(x=>x.book.id!==i.book.id))}><Trash2 size={14}/></button></div></div></div>)}</div><div className="drawer-foot"><div className="subtotal"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p>Shipping calculated at checkout.</p><button className="primary-button checkout-button" onClick={()=>{setCartOpen(false);setCheckoutOpen(true)}}>Continue to checkout <ArrowRight size={17}/></button></div></>}
  </aside></div>}
  {checkoutOpen&&<div className="overlay"><div className="modal"><div className="modal-head"><div><span className="eyebrow">ALMOST YOURS</span><h2>Checkout</h2></div><button className="icon-button" onClick={()=>setCheckoutOpen(false)}><X/></button></div><div className="checkout-total"><span>{count} book(s)</span><strong>{money(subtotal)}</strong></div><form onSubmit={placeOrder} className="checkout-form"><label>Full name<input required minLength={2} value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})} placeholder="Your name"/></label><label>Email address<input required type="email" value={customer.email} onChange={e=>setCustomer({...customer,email:e.target.value})} placeholder="you@example.com"/></label><label>Delivery address<textarea required minLength={5} value={customer.address} onChange={e=>setCustomer({...customer,address:e.target.value})} placeholder="Street, city, postal code"/></label><button className="primary-button checkout-button">Place order · {money(subtotal)}</button><p className="demo-note">Demo checkout — no payment is collected.</p></form></div></div>}
  {orderResult&&<div className="overlay"><div className="success-modal"><CheckCircle2 size={48}/><span className="eyebrow">ORDER CONFIRMED</span><h2>Your next chapter is on its way.</h2><p>Order #{orderResult.order_id} has been received. Your total is {money(orderResult.total)}.</p><button className="primary-button" onClick={()=>setOrderResult(null)}>Back to browsing</button></div></div>}
 </div>
}
