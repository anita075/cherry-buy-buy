import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  limit,
  setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  Search, 
  Plus, 
  LayoutDashboard, 
  X, 
  Trash2,
  Cherry,
  User,
  Package,
  ChevronRight,
  MinusCircle,
  PlusCircle,
  CheckCircle2,
  Circle,
  BellRing,
  BarChart3,
  Users,
  History,
  DollarSign,
  CreditCard,
  Settings2,
  Calendar,
  Check,
  ChevronDown,
  RotateCcw,
  Store,
  Calculator,
  ArrowRightLeft,
  Percent,
  TrendingUp,
  TrendingDown,
  Coins
} from 'lucide-react';
import { 
  Order, 
  Category, 
  DeliveryMethod, 
  OrderStatus, 
  MasterProduct,
  PurchaseRecord, 
  ExchangeRate, 
  PaymentType,
  CurrencyType
} from './types';

const StatCard = ({ title, value, colorClass, subtitle }: { title: string, value: string | number, colorClass: string, subtitle?: string }) => (
  <div className={`p-4 rounded-2xl ${colorClass} shadow-sm flex flex-col justify-between min-h-[100px] border border-black/5`}>
    <p className="text-[10px] font-black uppercase opacity-60 tracking-wider">{title}</p>
    <div>
      <h3 className="text-2xl font-black tracking-tighter">{value}</h3>
      {subtitle && <p className="text-[9px] font-medium opacity-50 mt-1">{subtitle}</p>}
    </div>
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bookkeeping' | 'rates'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyType>('JPY');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  
  const [operators, setOperators] = useState<string[]>(() => {
    const saved = localStorage.getItem('operators');
    return saved ? JSON.parse(saved) : ['芊妤', '書瑋', '語軒', '宜軒'];
  });

  const [selectedOperator, setSelectedOperator] = useState<string>(() => {
    return localStorage.getItem('selectedOperator') || '';
  });

  const [rateForm, setRateForm] = useState({
    id: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'JPY' as CurrencyType,
    cash: 0,
    visa: 0,
    jcb: 0
  });

  const [productForm, setProductForm] = useState({ id: '', name: '', suggestedPrice: 0 });
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  
  const [newOrder, setNewOrder] = useState<Partial<Order>>({
    customer: '',
    category: '一般',
    deliveryMethod: '未設定',
    shippingFee: 0,
    items: [],
    status: { isPaid: false, isProcessed: false, isShipped: false }
  });

  useEffect(() => {
    localStorage.setItem('operators', JSON.stringify(operators));
  }, [operators]);

  useEffect(() => {
    if (selectedOperator) localStorage.setItem('selectedOperator', selectedOperator);
  }, [selectedOperator]);

  // Data Sync
  useEffect(() => {
    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    const unsubRates = onSnapshot(query(collection(db, 'exchangeRates'), orderBy('date', 'desc'), limit(100)), (snapshot) => {
      setExchangeRates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExchangeRate)));
    });

    const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name', 'asc')), (snapshot) => {
      setMasterProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MasterProduct)));
    });

    return () => {
      unsubOrders();
      unsubRates();
      unsubProducts();
    };
  }, []);

  const activeOrders = useMemo(() => orders.filter(o => !o.isArchived && !o.isDeleted), [orders]);
  const archivedOrders = useMemo(() => orders.filter(o => o.isArchived || o.isDeleted), [orders]);

  const totalSales = useMemo(() => activeOrders.reduce((acc, o) => acc + o.totalAmount + (o.shippingFee || 0), 0), [activeOrders]);
  const processedCount = useMemo(() => activeOrders.filter(o => o.status.isProcessed).length, [activeOrders]);
  const unpaidCount = useMemo(() => activeOrders.filter(o => !o.status.isPaid).length, [activeOrders]);
  const unshippedCount = useMemo(() => activeOrders.filter(o => o.status.isProcessed && !o.status.isShipped).length, [activeOrders]);

  const pendingAmount = useMemo(() => activeOrders.filter(o => !o.status.isPaid).reduce((acc, o) => acc + o.totalAmount + (o.shippingFee || 0), 0), [activeOrders]);

  const currentActiveRate = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return exchangeRates.find(r => r.date === today && r.currency === selectedCurrency) || 
           exchangeRates.find(r => r.currency === selectedCurrency);
  }, [exchangeRates, selectedCurrency]);

  const productStats = useMemo(() => {
    const stats: Record<string, { totalQty: number, buyers: Set<string>, orders: Order[], totalSellingPrice: number, totalPurchasedCost: number }> = {};
    masterProducts.forEach(mp => {
      stats[mp.name] = { totalQty: 0, buyers: new Set(), orders: [], totalSellingPrice: 0, totalPurchasedCost: 0 };
    });
    activeOrders.forEach(order => {
      order.items.forEach(item => {
        const name = item.name || '未命名商品';
        if (!stats[name]) stats[name] = { totalQty: 0, buyers: new Set(), orders: [], totalSellingPrice: 0, totalPurchasedCost: 0 };
        stats[name].totalQty += item.qty;
        stats[name].buyers.add(order.customer);
        stats[name].totalSellingPrice += (item.qty * item.price);
        
        // Final Profit calc based on manual purchase record: TWD Cost = Foreign Price / Rate
        const itemPurchaseCost = (item.purchases || []).reduce((sum, p) => sum + (p.qty * (p.foreignPrice / (p.rate || 1))), 0);
        stats[name].totalPurchasedCost += itemPurchaseCost;
        if (!stats[name].orders.find(o => o.id === order.id)) stats[name].orders.push(order);
      });
    });
    return Object.entries(stats).sort((a, b) => b[1].totalQty - a[1].totalQty);
  }, [activeOrders, masterProducts]);

  const { filteredOrders, searchStats } = useMemo(() => {
    const queryToUse = searchQuery.trim().toLowerCase();
    if (!queryToUse) return { filteredOrders: activeOrders, searchStats: null };
    let totalQty = 0;
    const customers = new Set<string>();
    const filtered = activeOrders.filter(o => {
      const customerMatch = o.customer.toLowerCase().includes(queryToUse);
      let itemsMatch = false;
      o.items.forEach(item => {
        if (item.name.toLowerCase().includes(queryToUse)) {
          totalQty += item.qty;
          itemsMatch = true;
        }
      });
      if (itemsMatch || customerMatch) customers.add(o.customer);
      return customerMatch || itemsMatch;
    });
    return { filteredOrders: filtered, searchStats: { totalQty, customerCount: customers.size } };
  }, [activeOrders, searchQuery]);

  const getRateForPayment = (rate: ExchangeRate | undefined, type: PaymentType) => {
    if (!rate) return 0;
    if (type === '現金') return rate.cash;
    if (type === 'VISA') return rate.visa;
    if (type === 'JCB') return rate.jcb;
    return 0;
  };

  const calculateItemCost = (purchases: PurchaseRecord[]) => (purchases || []).reduce((sum, p) => sum + (p.qty * (p.foreignPrice / (p.rate || 1))), 0);

  const toggleOrderStatus = async (e: React.MouseEvent, orderId: string, field: keyof OrderStatus) => {
    e.stopPropagation();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const newStatus = { ...order.status, [field]: !order.status[field] };
    await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
  };

  const handleSaveRate = async () => {
    if (!rateForm.date) return alert('請選擇日期');
    try {
      const rateData = { date: rateForm.date, currency: rateForm.currency, cash: rateForm.cash, visa: rateForm.visa, jcb: rateForm.jcb, updatedAt: Date.now() };
      if (rateForm.id) {
        await setDoc(doc(db, 'exchangeRates', rateForm.id), rateData, { merge: true });
        setToastMessage('✅ 匯率已更新');
      } else {
        await addDoc(collection(db, 'exchangeRates'), { ...rateData, createdAt: Date.now() });
        setToastMessage('✅ 匯率新增成功');
      }
      setRateForm({ id: '', date: new Date().toISOString().split('T')[0], currency: 'JPY', cash: 0, visa: 0, jcb: 0 });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (e) { alert('儲存匯率失敗'); }
  };

  const handleEditRate = (rate: ExchangeRate) => {
    setRateForm({ id: rate.id, date: rate.date, currency: rate.currency || 'JPY', cash: rate.cash, visa: rate.visa, jcb: rate.jcb });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteRate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('確定刪除此匯率紀錄？')) await deleteDoc(doc(db, 'exchangeRates', id));
  };

  const handleSelectSuggestion = (idx: number, name: string) => {
    const items = [...(newOrder.items || [])];
    const product = masterProducts.find(p => p.name === name);
    items[idx].name = name;
    if (product) {
      items[idx].price = product.suggestedPrice;
    }
    setNewOrder({ ...newOrder, items });
    setFocusedItemIndex(null);
  };

  const handlePurchasedMinus = (idx: number) => {
    const items = [...(newOrder.items || [])];
    const item = items[idx];
    if (item.purchases && item.purchases.length > 0) {
      if (item.purchases[0].qty > 0) {
        item.purchases[0].qty--;
        item.cost = calculateItemCost(item.purchases);
        setNewOrder({ ...newOrder, items });
      }
    }
  };

  const handlePurchasedPlus = (idx: number) => {
    const items = [...(newOrder.items || [])];
    const item = items[idx];
    if (!item.purchases) item.purchases = [];
    if (item.purchases.length === 0) {
        const rate = getRateForPayment(currentActiveRate, item.paymentType);
        item.purchases.push({ qty: 0, rate: rate || 1, foreignPrice: 0, paymentType: item.paymentType, date: new Date().toISOString().split('T')[0] });
    }
    item.purchases[0].qty++;
    item.cost = calculateItemCost(item.purchases);
    setNewOrder({ ...newOrder, items });
  };

  const openAddOrderModal = () => {
    setEditingOrderId(null);
    const initialRate = getRateForPayment(currentActiveRate, 'VISA');
    setNewOrder({
      customer: '', category: '一般', deliveryMethod: '未設定', shippingFee: 0,
      items: [{ 
        name: '', qty: 0, price: 0, cost: 0, paymentType: 'VISA',
        purchases: [{ qty: 0, rate: initialRate || 1, foreignPrice: 0, paymentType: 'VISA', date: currentActiveRate?.date || new Date().toISOString().split('T')[0] }] 
      }],
      status: { isPaid: false, isProcessed: false, isShipped: false }
    });
    setIsModalOpen(true);
  };

  const openEditOrderModal = (order: Order) => { 
    setEditingOrderId(order.id); 
    setNewOrder({ ...order }); 
    setIsModalOpen(true); 
  };

  const handleSaveOrder = async () => {
    if (!selectedOperator) return alert('請先選擇操作人員');
    if (!newOrder.customer?.trim()) return alert('請輸入買家姓名');
    
    const items = newOrder.items || [];
    // Auto-process logic: all items must have purchased qty >= total qty
    const allProcessed = items.length > 0 && items.every(item => {
      const purchasedQty = (item.purchases || []).reduce((s, p) => s + p.qty, 0);
      return purchasedQty >= item.qty && item.qty > 0;
    });

    const subtotal = items.reduce((acc, i) => acc + (i.qty * i.price), 0);
    const orderData = { 
      ...newOrder, 
      totalAmount: subtotal, 
      addedBy: selectedOperator, 
      status: { ...newOrder.status, isProcessed: allProcessed }, 
      updatedAt: Date.now() 
    };

    try {
      if (editingOrderId) { 
        await updateDoc(doc(db, 'orders', editingOrderId), orderData); 
      } else { 
        await addDoc(collection(db, 'orders'), { ...orderData, createdAt: Date.now(), isArchived: false, isDeleted: false }); 
      }
      setIsModalOpen(false);
      setToastMessage('✅ 訂單已儲存');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (e) { alert("儲存失敗"); }
  };

  // Pricing helper for modal items
  const updateItemPricing = (idx: number, field: string, value: any) => {
    const items = [...(newOrder.items || [])];
    const item = items[idx];
    if (field === 'foreignPrice') {
        item.purchases[0].foreignPrice = Number(value);
    } else if (field === 'rate') {
        item.purchases[0].rate = Number(value);
    } else if (field === 'margin') {
        // We use this to calculate suggested TWD price
        const cost = item.purchases[0].rate > 0 ? item.purchases[0].foreignPrice / item.purchases[0].rate : 0;
        item.price = Math.ceil(cost * (1 + Number(value) / 100));
    }
    item.cost = calculateItemCost(item.purchases);
    setNewOrder({ ...newOrder, items });
  };

  return (
    <div className="max-w-md mx-auto min-h-screen pb-32 bg-[#F8FAF9] text-slate-800 antialiased font-sans">
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm animate-in fade-in slide-in-from-top-4">
          <div className="bg-slate-900 text-white rounded-3xl p-4 flex items-center gap-3 shadow-2xl border border-white/10">
            <div className="bg-[#3EB075] p-2 rounded-xl"><BellRing size={20} className="animate-bounce" /></div>
            <p className="text-sm font-black">{toastMessage}</p>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="p-4 space-y-4 animate-in fade-in duration-300">
          <header className="flex justify-between items-center py-2">
            <h1 className="text-2xl font-black tracking-tighter uppercase italic text-slate-900">Cherry Buy Buy</h1>
            <div className="flex gap-2">
              <button onClick={() => setIsRecycleBinOpen(true)} className="p-2.5 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400 active:scale-95 transition-all"><Trash2 size={22} /></button>
              <button onClick={() => setIsSearchOpen(true)} className="p-2.5 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-600 active:scale-95 transition-all"><Search size={22} /></button>
            </div>
          </header>

          <section className="bg-slate-900 rounded-[32px] p-7 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-[-20px] right-[-20px] opacity-10 rotate-12"><Package size={200} /></div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="space-y-1"><p className="text-[10px] font-black opacity-50 tracking-[0.2em] uppercase">總銷售 (含運)</p><h2 className="text-3xl font-black tracking-tighter">NT$ {totalSales.toLocaleString()}</h2></div>
              <div className="space-y-1"><p className="text-[10px] font-black opacity-50 tracking-[0.2em] uppercase">待入帳金額</p><h2 className="text-3xl font-black tracking-tighter text-orange-400">NT$ {pendingAmount.toLocaleString()}</h2></div>
            </div>
            <div className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl backdrop-blur-md">
              <div className="bg-[#3EB075] px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">今日匯率基準</div>
              <select value={selectedCurrency} onChange={(e) => setSelectedCurrency(e.target.value as CurrencyType)} className="bg-transparent border-none text-xs font-black outline-none cursor-pointer text-white">
                <option value="JPY" className="text-black">JPY</option><option value="KRW" className="text-black">KRW</option><option value="USD" className="text-black">USD</option><option value="EUR" className="text-black">EUR</option><option value="TWD" className="text-black">TWD</option>
              </select>
              <p className="text-xs font-bold opacity-80 flex-1 text-right">V: {currentActiveRate?.visa || '--'} / C: {currentActiveRate?.cash || '--'}</p>
            </div>
          </section>

          <div className="grid grid-cols-3 gap-3">
            <StatCard title="待付款" value={unpaidCount} colorClass="bg-white text-orange-500" />
            <StatCard title="已處理" value={processedCount} colorClass="bg-white text-indigo-500" />
            <StatCard title="未出貨" value={unshippedCount} colorClass="bg-white text-[#3EB075]" />
          </div>

          <div className="space-y-4 pb-12">
            {filteredOrders.map(order => (
              <div key={order.id} onClick={() => openEditOrderModal(order)} className="bg-white rounded-[28px] p-5 shadow-sm border border-slate-100 space-y-4 active:scale-[0.98] transition-all cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${order.category === '免運' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>{order.category}</span>
                        <span className="text-[9px] font-black bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">{order.deliveryMethod}</span>
                    </div>
                    <h3 className="text-lg font-black flex items-center gap-2"><User size={14} className="text-slate-300" /> {order.customer}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">{new Date(order.createdAt).toLocaleDateString()}</p>
                    <p className="text-xl font-black text-slate-900 tracking-tighter">NT${(order.totalAmount + (order.shippingFee || 0)).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={(e) => toggleOrderStatus(e, order.id, 'isPaid')} className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-1 ${order.status.isPaid ? 'bg-orange-500 text-white border-orange-500' : 'bg-transparent text-slate-400 border-slate-200'}`}>{order.status.isPaid ? <CheckCircle2 size={12}/> : <Check size={12}/>} 已付款</button>
                  <button onClick={(e) => toggleOrderStatus(e, order.id, 'isProcessed')} className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-1 ${order.status.isProcessed ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent text-slate-400 border-slate-200'}`}>{order.status.isProcessed ? <CheckCircle2 size={12}/> : <Circle size={12}/>} 已處理</button>
                  <button onClick={(e) => toggleOrderStatus(e, order.id, 'isShipped')} className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-1 ${order.status.isShipped ? 'bg-[#3EB075] text-white border-[#3EB075]' : 'bg-transparent text-slate-400 border-slate-200'}`}>{order.status.isShipped ? <CheckCircle2 size={12}/> : <Circle size={12}/>} 已出貨</button>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3 flex justify-between items-center text-xs font-bold text-slate-600">
                  <p className="truncate flex-1">{order.items.map(i => `${i.name}x${i.qty}`).join(', ')}</p>
                  <button onClick={(e) => { e.stopPropagation(); updateDoc(doc(db, 'orders', order.id), { isArchived: true }); setToastMessage('🗑️ 已移至回收桶'); setTimeout(() => setToastMessage(null), 2000); }} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'rates' && (
        <div className="p-4 space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center gap-2"><Settings2 size={24} className="text-slate-900" /><h1 className="text-2xl font-black tracking-tighter italic uppercase">匯率與定價維護</h1></div>
          
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center gap-2 text-slate-900"><ArrowRightLeft size={18}/><h4 className="text-[11px] font-black uppercase tracking-widest">匯率數值維護</h4></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 px-1">日期</label><input type="date" value={rateForm.date} onChange={e => setRateForm({...rateForm, date: e.target.value})} className="w-full h-11 bg-slate-50 rounded-2xl px-4 font-black text-sm outline-none" /></div>
              <div className="relative"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 px-1">幣別</label><select value={rateForm.currency} onChange={e => setRateForm({...rateForm, currency: e.target.value as CurrencyType})} className="w-full h-11 bg-slate-50 rounded-2xl px-4 font-black text-sm outline-none"><option value="JPY">JPY</option><option value="KRW">KRW</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="TWD">TWD</option></select></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[10px] font-black text-slate-400 block mb-1 px-1">現金(採購)</label><input type="number" step="0.0001" value={rateForm.cash || ''} onChange={e => setRateForm({...rateForm, cash: Number(e.target.value)})} className="w-full h-11 bg-slate-50 rounded-2xl px-4 font-black outline-none text-sm" placeholder="0.00" /></div>
              <div><label className="text-[10px] font-black text-slate-400 block mb-1 px-1">VISA</label><input type="number" step="0.0001" value={rateForm.visa || ''} onChange={e => setRateForm({...rateForm, visa: Number(e.target.value)})} className="w-full h-11 bg-slate-50 rounded-2xl px-4 font-black outline-none text-sm" placeholder="0.00" /></div>
              <div><label className="text-[10px] font-black text-slate-400 block mb-1 px-1">JCB</label><input type="number" step="0.0001" value={rateForm.jcb || ''} onChange={e => setRateForm({...rateForm, jcb: Number(e.target.value)})} className="w-full h-11 bg-slate-50 rounded-2xl px-4 font-black outline-none text-sm" placeholder="0.00" /></div>
            </div>
            <button onClick={handleSaveRate} className="w-full h-12 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95"><Check size={18} /> {rateForm.id ? '更新選中紀錄' : '儲存匯率數值'}</button>
            {rateForm.id && <button onClick={() => setRateForm({ id: '', date: new Date().toISOString().split('T')[0], currency: 'JPY', cash: 0, visa: 0, jcb: 0 })} className="w-full h-10 text-[10px] font-black text-slate-400 uppercase tracking-widest border border-dashed border-slate-200 rounded-xl">重置表單</button>}
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">歷史紀錄 (點擊可修改)</h4>
            {exchangeRates.map(r => (
              <div key={r.id} onClick={() => handleEditRate(r)} className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all">
                <div><p className="text-sm font-black text-slate-900 italic">{r.date} <span className="text-indigo-600 ml-2">[{r.currency}]</span></p><p className="text-[10px] font-bold text-slate-400 uppercase">C: {r.cash} / V: {r.visa} / J: {r.jcb}</p></div>
                <button onClick={(e) => deleteRate(r.id, e)} className="p-2 text-slate-200 hover:text-red-500"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'bookkeeping' && (
        <div className="p-4 space-y-4 animate-in fade-in duration-300">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Cherry size={24} className="text-[#FF4D6D]" /><h1 className="text-2xl font-black tracking-tighter italic uppercase">採購利潤分析</h1></div>
              <button onClick={() => { setProductForm({ id: '', name: '', suggestedPrice: 0 }); setIsProductModalOpen(true); }} className="text-[10px] font-black text-[#3EB075] px-3 py-1.5 bg-[#E4F7ED] rounded-xl flex items-center gap-1"><Plus size={14} /> 新增產品庫</button>
           </div>
           
           <section className="bg-slate-900 rounded-[32px] p-7 text-white shadow-2xl relative overflow-hidden">
             <div className="absolute top-[-20px] right-[-20px] opacity-10 rotate-12"><CreditCard size={200} /></div>
             <div className="grid grid-cols-2 gap-4 relative z-10">
               <div className="space-y-1"><p className="text-[10px] font-black opacity-50 tracking-[0.2em] uppercase">待入帳金額</p><h2 className="text-2xl font-black tracking-tighter text-orange-400">NT$ {pendingAmount.toLocaleString()}</h2></div>
               <div className="space-y-1"><p className="text-[10px] font-black opacity-50 tracking-[0.2em] uppercase">今日匯率基準</p><h2 className="text-2xl font-black tracking-tighter text-indigo-400">{currentActiveRate?.cash || currentActiveRate?.visa || '--'}</h2></div>
             </div>
           </section>

           <div className="space-y-4">
              {productStats.map(([name, stat]) => {
                const profit = stat.totalSellingPrice - stat.totalPurchasedCost;
                return (
                  <div key={name} className="bg-white rounded-[24px] overflow-hidden shadow-sm border border-slate-100 transition-all">
                    <div onClick={() => setExpandedProduct(expandedProduct === name ? null : name)} className="p-5 flex justify-between items-center cursor-pointer active:bg-slate-50">
                      <div className="space-y-3 flex-1 pr-4">
                        <h5 className="font-black text-slate-900 text-base">{name}</h5>
                        {/* Dashboard Style Financial Layout */}
                        <div className="flex gap-2 w-full">
                          <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl py-2 px-1 text-center">
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">總成本</p>
                            <p className="text-[10px] font-black text-slate-500 leading-none">NT${Math.round(stat.totalPurchasedCost).toLocaleString()}</p>
                          </div>
                          <div className="flex-1 bg-blue-50 border border-blue-100 rounded-xl py-2 px-1 text-center">
                            <p className="text-[7px] font-black text-blue-400 uppercase tracking-tighter mb-0.5">總收益</p>
                            <p className="text-[10px] font-black text-blue-600 leading-none">NT${Math.round(stat.totalSellingPrice).toLocaleString()}</p>
                          </div>
                          <div className={`flex-1 border rounded-xl py-2 px-1 text-center ${profit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                            <p className={`text-[7px] font-black uppercase tracking-tighter mb-0.5 ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>總利潤</p>
                            <p className={`text-[10px] font-black leading-none ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>NT${Math.round(profit).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      {expandedProduct === name ? <ChevronDown size={20} className="text-slate-300" /> : <ChevronRight size={20} className="text-slate-300" />}
                    </div>
                    {expandedProduct === name && (
                      <div className="bg-slate-50/50 border-t border-slate-50 p-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                        {/* Detailed Reference Info at top of expanded section */}
                        <div className="flex gap-4 mb-1">
                          <div className="flex-1 bg-white p-2.5 rounded-2xl border border-slate-100 text-center shadow-sm">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">總需求數量</p>
                            <div className="flex items-center justify-center gap-1.5"><Package size={12} className="text-slate-300"/><p className="text-sm font-black text-slate-900">{stat.totalQty} PCS</p></div>
                          </div>
                          <div className="flex-1 bg-white p-2.5 rounded-2xl border border-slate-100 text-center shadow-sm">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">訂購總人數</p>
                            <div className="flex items-center justify-center gap-1.5"><Users size={12} className="text-slate-300"/><p className="text-sm font-black text-slate-900">{stat.buyers.size} 人</p></div>
                          </div>
                        </div>
                        
                        {stat.orders.length === 0 ? (
                          <p className="text-[10px] text-slate-400 font-bold italic text-center py-2">目前尚無相關訂單</p>
                        ) : (
                          <div className="space-y-2">
                            {stat.orders.map(o => (
                              <div key={o.id} onClick={() => openEditOrderModal(o)} className="bg-white p-3 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100 active:scale-95 transition-all cursor-pointer">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${o.status.isProcessed ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {o.customer.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-slate-900">{o.customer}</p>
                                    <p className="text-[8px] text-slate-400 font-bold uppercase">{o.items.find(i => i.name === name)?.qty || 0} PCS</p>
                                  </div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                   <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">{new Date(o.createdAt).toLocaleDateString()}</p>
                                   <p className="text-sm font-black text-slate-900">NT${(o.totalAmount + (o.shippingFee || 0)).toLocaleString()}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {/* Recycle Bin Full Screen */}
      {isRecycleBinOpen && (
        <div className="fixed inset-0 bg-white z-[300] flex flex-col animate-in slide-in-from-right duration-300">
          <header className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="text-2xl font-black tracking-tighter italic uppercase flex items-center gap-2"><Trash2 className="text-slate-400" /> 資源回收桶</h3><button onClick={() => setIsRecycleBinOpen(false)} className="p-3 bg-slate-50 rounded-2xl"><X size={24}/></button></header>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {archivedOrders.length === 0 ? <div className="h-64 flex flex-col items-center justify-center text-slate-300 gap-4"><Package size={48} opacity={0.3} /><p className="font-bold text-sm">回收桶內目前沒有訂單</p></div> : archivedOrders.map(order => (
                <div key={order.id} className="bg-white rounded-[24px] p-4 shadow-sm border border-slate-100 space-y-3">
                  <div className="flex justify-between items-start"><div><h4 className="font-black text-slate-900">{order.customer}</h4><p className="text-[10px] text-slate-400 font-bold">{new Date(order.createdAt).toLocaleDateString()}</p></div><p className="font-black text-slate-900">NT${(order.totalAmount + (order.shippingFee || 0)).toLocaleString()}</p></div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={async (e) => { e.stopPropagation(); await updateDoc(doc(db, 'orders', order.id), { isArchived: false, isDeleted: false }); setToastMessage('✅ 訂單已還原'); setTimeout(() => setToastMessage(null), 3000); }} className="flex-1 h-10 bg-indigo-50 text-indigo-600 rounded-xl text-[11px] font-black flex items-center justify-center gap-2"><RotateCcw size={14} /> 還原</button>
                    <button onClick={async (e) => { e.stopPropagation(); if(window.confirm('確定永久刪除？')) await deleteDoc(doc(db, 'orders', order.id)); }} className="flex-1 h-10 bg-red-50 text-red-500 rounded-xl text-[11px] font-black flex items-center justify-center gap-2"><Trash2 size={14} /> 永久刪除</button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[250] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 space-y-6 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center"><h3 className="text-xl font-black tracking-tighter italic uppercase flex items-center gap-2"><Store size={20} /> 產品庫管理</h3><button onClick={() => setIsProductModalOpen(false)}><X size={24}/></button></div>
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">產品名稱</label><input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full h-12 bg-slate-50 rounded-2xl px-4 font-black outline-none" placeholder="輸入產品名" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">預設售價 (TWD)</label><input type="number" value={productForm.suggestedPrice || ''} onChange={e => setProductForm({...productForm, suggestedPrice: Number(e.target.value)})} className="w-full h-12 bg-slate-50 rounded-2xl px-4 font-black outline-none" placeholder="0" /></div>
              <button onClick={async () => {
                if(!productForm.name.trim()) return alert('請輸入產品名');
                if(productForm.id) { await updateDoc(doc(db, 'products', productForm.id), { name: productForm.name, suggestedPrice: productForm.suggestedPrice }); }
                else { await addDoc(collection(db, 'products'), { name: productForm.name, suggestedPrice: productForm.suggestedPrice, createdAt: Date.now() }); }
                setIsProductModalOpen(false); setToastMessage('✅ 產品庫已更新'); setTimeout(() => setToastMessage(null), 3000);
              }} className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl">儲存到產品庫</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={openAddOrderModal} className="fixed bottom-24 right-6 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center z-[150] border-4 border-white active:scale-90 transition-all shadow-green-500/20"><Plus size={32} strokeWidth={3} /></button>

      {isSearchOpen && (
        <div className="fixed inset-0 bg-white z-[160] animate-in slide-in-from-top duration-400 p-4 flex flex-col">
            <div className="flex items-center gap-4 mb-4 py-4 border-b border-slate-50"><button onClick={() => setIsSearchOpen(false)} className="p-3 bg-slate-100 rounded-2xl text-slate-500"><X size={24}/></button><div className="flex-1 relative"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} /><input autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full h-14 bg-slate-50 rounded-[24px] pl-14 pr-12 py-4 outline-none font-black text-sm text-slate-900" placeholder="搜尋客戶、商品..." />{searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500"><X size={18} /></button>}</div></div>
            {searchStats && searchQuery.trim() !== '' && <div className="mb-6 grid grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300"><div className="bg-[#FF4D6D]/5 border border-[#FF4D6D]/10 rounded-[28px] p-5 flex items-center gap-4"><div className="bg-[#FF4D6D] p-3 rounded-2xl text-white"><BarChart3 size={20} /></div><div><p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">總需求量</p><p className="text-xl font-black text-[#FF4D6D]">{searchStats.totalQty}</p></div></div><div className="bg-[#3EB075]/5 border border-[#3EB075]/10 rounded-[28px] p-5 flex items-center gap-4"><div className="bg-[#3EB075] p-3 rounded-2xl text-white"><Users size={20} /></div><div><p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">訂購客戶</p><p className="text-xl font-black text-[#3EB075]">{searchStats.customerCount}</p></div></div></div>}
            <div className="space-y-4 pb-20 overflow-y-auto scrollbar-hide flex-1">{filteredOrders.map(order => (
                <div key={order.id} onClick={() => { setIsSearchOpen(false); openEditOrderModal(order); }} className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 flex justify-between items-center transition-all active:scale-95 cursor-pointer"><div className="space-y-2 flex-1 pr-2"><div className="flex items-center gap-2"><span className="text-[9px] font-black bg-red-50 text-[#FF4D6D] px-2 py-0.5 rounded-full uppercase">{order.customer}</span><div className="text-right flex flex-col items-end scale-90 origin-right"><span className="text-[8px] text-slate-300 font-bold uppercase mb-0.5">{new Date(order.createdAt).toLocaleDateString()}</span><span className="text-[10px] font-black text-slate-900 uppercase">NT${(order.totalAmount + (order.shippingFee || 0)).toLocaleString()}</span></div></div><h3 className="font-black text-slate-900 text-base truncate">{order.items.map(i => `${i.name}x${i.qty}`).join(', ')}</h3></div><ChevronRight size={20} className="text-slate-200" /></div>
              ))}</div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[170] flex items-end p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-[48px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-400 my-auto">
            <div className="p-8 pb-4 flex justify-between items-center"><h3 className="text-3xl font-black tracking-tighter uppercase italic">{editingOrderId ? '更新訂單內容' : '建立全新訂單'}</h3><button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-2xl"><X size={24}/></button></div>
            <div className="p-8 pt-4 max-h-[70vh] overflow-y-auto space-y-6 scrollbar-hide">
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-1 tracking-widest">操作人員</label><div className="flex flex-wrap gap-2">{operators.map(name => <button key={name} onClick={() => setSelectedOperator(name)} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all border ${selectedOperator === name ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{name}</button>)}<button onClick={() => { const n = window.prompt('輸入新人員'); if(n?.trim()) setOperators([...operators, n.trim()]); }} className="w-10 h-10 rounded-xl border-2 border-dashed border-slate-200 text-slate-300 flex items-center justify-center"><Plus size={16}/></button></div></div>
              <div className="flex gap-4"><div className="flex-[2] space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase block px-1 tracking-widest">買家姓名</label><input type="text" value={newOrder.customer} onChange={e => setNewOrder({...newOrder, customer: e.target.value})} placeholder="請輸入姓名" className="w-full h-12 bg-slate-50 rounded-2xl px-4 font-black outline-none" /></div><div className="flex-1 space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase block px-1 tracking-widest">分類</label><select value={newOrder.category} onChange={e => setNewOrder({...newOrder, category: e.target.value as Category})} className="w-full h-12 bg-slate-50 rounded-2xl px-4 font-black outline-none"><option value="一般">一般</option><option value="免運">免運</option></select></div></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-1 tracking-widest">寄送方式 (SHIPPING)</label><div className="flex flex-wrap gap-2">{(['面交', '郵寄', '賣貨便'] as DeliveryMethod[]).map(method => (<button key={method} onClick={() => setNewOrder({ ...newOrder, deliveryMethod: method })} className={`px-4 py-2.5 rounded-xl text-[11px] font-black transition-all border ${newOrder.deliveryMethod === method ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-105' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{method}</button>))}</div></div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase block px-1 tracking-widest">運費金額</label><div className="relative"><input type="number" value={newOrder.shippingFee || ''} disabled={newOrder.category === '免運'} onChange={e => setNewOrder({...newOrder, shippingFee: Number(e.target.value)})} placeholder="0" className="w-full h-12 bg-slate-50 rounded-2xl px-12 font-black outline-none disabled:opacity-50" /><DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" /></div></div>
              <div className="space-y-4">
                <div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">品項詳情與定價工具</label><button onClick={() => { const ir = getRateForPayment(currentActiveRate, 'VISA'); setNewOrder(prev => ({...prev, items: [...(prev.items || []), { name: '', qty: 0, purchases: [{ qty: 0, rate: ir || 1, foreignPrice: 0, paymentType: 'VISA', date: currentActiveRate?.date || new Date().toISOString().split('T')[0] }], price: 0, cost: 0, paymentType: 'VISA' }]})); }} className="text-[10px] font-black text-[#3EB075] px-3 py-1.5 bg-[#E4F7ED] rounded-xl flex items-center gap-1"><Plus size={14} /> 新增品項</button></div>
                {newOrder.items?.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 p-5 rounded-[32px] space-y-4 border border-slate-100 shadow-inner">
                    <div className="flex items-center gap-3"><div className="flex-1 relative"><input type="text" value={item.name} onFocus={() => setFocusedItemIndex(idx)} onBlur={() => setTimeout(() => setFocusedItemIndex(null), 200)} onChange={e => { const items = [...(newOrder.items || [])]; items[idx].name = e.target.value; setNewOrder({...newOrder, items}); }} className="w-full h-10 bg-white rounded-xl px-4 font-bold outline-none border border-slate-100" placeholder="產品名稱" />{focusedItemIndex === idx && masterProducts.filter(p => p.name.toLowerCase().includes(item.name.toLowerCase())).length > 0 && <div className="absolute left-0 right-0 top-12 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[200] max-h-40 overflow-y-auto">{masterProducts.filter(p => p.name.toLowerCase().includes(item.name.toLowerCase())).map(p => <button key={p.id} onMouseDown={() => handleSelectSuggestion(idx, p.name)} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold border-b border-slate-50 last:border-none">{p.name}</button>)}</div>}</div><button onClick={() => { const items = newOrder.items?.filter((_, i) => i !== idx); setNewOrder({...newOrder, items}); }} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={20}/></button></div>
                    
                    {/* Professional Pricing Integration for this Item */}
                    <div className="bg-white/50 p-3 rounded-2xl space-y-2 border border-slate-100">
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-[8px] font-black text-slate-400 uppercase">外幣採購價</label><input type="number" value={item.purchases[0]?.foreignPrice || ''} onChange={e => updateItemPricing(idx, 'foreignPrice', e.target.value)} className="w-full h-8 bg-white border border-slate-100 rounded-lg px-2 text-xs font-black outline-none" placeholder="0.00" /></div>
                            <div><label className="text-[8px] font-black text-slate-400 uppercase">採購匯率(TWD基準)</label><input type="number" step="0.001" value={item.purchases[0]?.rate || ''} onChange={e => updateItemPricing(idx, 'rate', e.target.value)} className="w-full h-8 bg-white border border-slate-100 rounded-lg px-2 text-xs font-black outline-none" placeholder="0.000" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-[8px] font-black text-slate-400 uppercase">目標利潤 (%)</label><input type="number" placeholder="30" onChange={e => updateItemPricing(idx, 'margin', e.target.value)} className="w-full h-8 bg-white border border-slate-100 rounded-lg px-2 text-xs font-black outline-none" /></div>
                            <div><label className="text-[8px] font-black text-slate-400 uppercase">試算成本 (TWD)</label><div className="h-8 flex items-center px-2 text-[10px] font-black text-green-600 bg-green-50 rounded-lg">NT${Math.round(item.cost || 0).toLocaleString()}</div></div>
                        </div>
                    </div>

                    <div className="flex gap-2">{(['現金', 'VISA', 'JCB'] as PaymentType[]).map(t => (<button key={t} onClick={() => { const items = [...(newOrder.items || [])]; items[idx].paymentType = t; const r = getRateForPayment(currentActiveRate, t); if(items[idx].purchases.length > 0) { items[idx].purchases[0].paymentType = t; items[idx].purchases[0].rate = r || 1; } items[idx].cost = calculateItemCost(items[idx].purchases); setNewOrder({...newOrder, items}); }} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black border ${item.paymentType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-100'}`}>{t}</button>))}</div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl h-10 flex items-center px-2 gap-2 shadow-sm border border-slate-100">
                            <button onClick={() => { const items = [...(newOrder.items || [])]; if(items[idx].qty > 0) items[idx].qty--; setNewOrder({...newOrder, items}); }}><MinusCircle size={18} className="text-slate-200"/></button>
                            <span className="flex-1 text-center font-black text-xs">{item.qty}</span>
                            <button onClick={() => { const items = [...(newOrder.items || [])]; items[idx].qty++; setNewOrder({...newOrder, items}); }}><PlusCircle size={18} className="text-slate-400"/></button>
                        </div>
                        <div className="bg-amber-50 rounded-xl h-10 flex items-center px-2 gap-2 border border-amber-100">
                            <button onClick={() => handlePurchasedMinus(idx)}><MinusCircle size={18} className="text-amber-200"/></button>
                            <span className="flex-1 text-center font-black text-xs text-amber-600">{(item.purchases || []).reduce((s, p) => s + p.qty, 0)}</span>
                            <button onClick={() => handlePurchasedPlus(idx)}><PlusCircle size={18} className="text-amber-400"/></button>
                        </div>
                    </div>
                    <div className="relative flex items-center h-10"><input type="number" value={item.price || ''} onChange={e => { const items = [...(newOrder.items || [])]; items[idx].price = Number(e.target.value); setNewOrder({...newOrder, items}); }} className="w-full h-full bg-white rounded-xl px-4 text-right font-black text-sm outline-none border border-slate-100" placeholder="最終銷售單價 (TWD)" /><DollarSign size={14} className="absolute left-4 text-slate-300" /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shadow-[0_-10px_60px_rgba(0,0,0,0.6)]">
                <div><p className="text-[10px] opacity-40 font-black uppercase tracking-[0.2em] mb-1">應收總額</p><h4 className="text-3xl font-black italic tracking-tighter">NT$ {((newOrder.items?.reduce((s, i) => s + (i.price * i.qty), 0) || 0) + (newOrder.shippingFee || 0)).toLocaleString()}</h4></div>
                <button onClick={handleSaveOrder} className="bg-[#3EB075] px-10 py-4 rounded-3xl font-black text-sm shadow-xl active:scale-90 transition-all">儲存訂單</button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-slate-100 h-20 z-[100] safe-bottom shadow-xl">
        <div className="flex justify-around items-center h-full">
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'dashboard' ? 'text-[#3EB075] scale-110 font-black' : 'text-slate-300'}`}><LayoutDashboard size={24} strokeWidth={activeTab === 'dashboard' ? 3 : 2} /><span className="text-[10px] uppercase tracking-widest font-black">訂單管理</span></button>
          <button onClick={() => setActiveTab('rates')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'rates' ? 'text-indigo-600 scale-110 font-black' : 'text-slate-300'}`}><Calculator size={24} strokeWidth={activeTab === 'rates' ? 3 : 2} /><span className="text-[10px] uppercase tracking-widest font-black">定價匯率</span></button>
          <button onClick={() => setActiveTab('bookkeeping')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'bookkeeping' ? 'text-[#FF4D6D] scale-110 font-black' : 'text-slate-300'}`}><Cherry size={24} strokeWidth={activeTab === 'bookkeeping' ? 3 : 2} /><span className="text-[10px] uppercase tracking-widest font-black">利潤分析</span></button>
        </div>
      </nav>
    </div>
  );
};

export default App;