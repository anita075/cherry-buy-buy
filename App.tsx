import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  Search, 
  Plus, 
  LayoutDashboard, 
  X, 
  Trash2,
  TrendingUp,
  Tag,
  Cherry, 
  User,
  Package,
  RotateCcw,
  Edit3,
  ChevronRight,
  ShoppingCart,
  MinusCircle,
  PlusCircle,
  Wallet,
  UserCheck,
  CheckCircle2,
  Circle,
  BellRing,
  Zap,
  BarChart3,
  Users
} from 'lucide-react';
import { Order, Category, DeliveryMethod, OrderStatus, BookkeepingEntry, OrderItem } from './types';

// Stat Card Component
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bookkeeping'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookkeepingRecords, setBookkeepingRecords] = useState<BookkeepingEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // 智慧建議相關狀態
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  
  const currencies = ['JPY', 'KRW', 'USD', 'EUR', 'CNY', 'THB'];
  
  const [operators, setOperators] = useState<string[]>(() => {
    const saved = localStorage.getItem('operators');
    const defaultList = ['芊妤', '書瑋', '語軒', '宜軒'];
    try {
      return saved ? JSON.parse(saved) : defaultList;
    } catch (e) {
      return defaultList;
    }
  });

  const [selectedOperator, setSelectedOperator] = useState<string>(() => {
    return localStorage.getItem('selectedOperator') || '';
  });

  const [costCalc, setCostCalc] = useState({
    itemName: '',
    currency: 'JPY',
    foreignPrice: 0,
    rate: 0,
    targetMargin: 0,
    sellingPrice: 0
  });
  
  const [editingBookkeepingId, setEditingBookkeepingId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  
  const [newOrder, setNewOrder] = useState<Partial<Order>>({
    customer: '',
    category: '一般',
    deliveryMethod: '未設定',
    items: [{ name: '', qty: 1, purchasedQty: 0, price: 0, cost: 0 }],
    status: { isPaid: false, isProcessed: false, isShipped: false }
  });

  useEffect(() => {
    localStorage.setItem('operators', JSON.stringify(operators));
  }, [operators]);

  useEffect(() => {
    if (selectedOperator) {
      localStorage.setItem('selectedOperator', selectedOperator);
    }
  }, [selectedOperator]);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(ordersData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'bookkeeping'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BookkeepingEntry[];
      setBookkeepingRecords(data);
    });
    return () => unsubscribe();
  }, []);

  const activeOrders = useMemo(() => orders.filter(o => !o.isDeleted), [orders]);
  const trashOrders = useMemo(() => orders.filter(o => !!o.isDeleted), [orders]);

  const totalSales = useMemo(() => activeOrders.reduce((acc, o) => acc + o.totalAmount, 0), [activeOrders]);
  const pendingIncome = useMemo(() => activeOrders.filter(o => !o.status.isPaid).reduce((acc, o) => acc + o.totalAmount, 0), [activeOrders]);
  const processedCount = useMemo(() => activeOrders.filter(o => o.status.isProcessed).length, [activeOrders]);
  const untreatedCount = useMemo(() => activeOrders.filter(o => !o.status.isProcessed && !o.status.isShipped).length, [activeOrders]);

  const historyItemNames = useMemo(() => {
    const names = bookkeepingRecords.map(r => r.itemName);
    return Array.from(new Set(names));
  }, [bookkeepingRecords]);

  // 搜尋過濾與產品匯總分析統計
  const { filteredOrders, searchStats } = useMemo(() => {
    if (!searchQuery.trim()) return { filteredOrders: [], searchStats: null };
    
    const lowerQuery = searchQuery.toLowerCase();
    let totalQty = 0;
    const customers = new Set<string>();

    const filtered = activeOrders.filter(o => {
      const customerMatch = o.customer.toLowerCase().includes(lowerQuery);
      let itemsMatch = false;
      
      o.items.forEach(item => {
        if (item.name.toLowerCase().includes(lowerQuery)) {
          totalQty += item.qty;
          itemsMatch = true;
        }
      });

      if (itemsMatch) {
        customers.add(o.customer);
      }
      
      return customerMatch || itemsMatch;
    });

    return { 
      filteredOrders: filtered, 
      searchStats: { totalQty, customerCount: customers.size } 
    };
  }, [activeOrders, searchQuery]);

  const currentTwdCost = useMemo(() => {
    if (!costCalc.rate || costCalc.rate === 0) return 0;
    return costCalc.foreignPrice / costCalc.rate;
  }, [costCalc.foreignPrice, costCalc.rate]);

  const recommendedPrice = useMemo(() => {
    return currentTwdCost * (1 + (costCalc.targetMargin / 100));
  }, [currentTwdCost, costCalc.targetMargin]);

  const handleSaveBookkeeping = async () => {
    if (!costCalc.itemName.trim()) return alert('請輸入產品名稱');
    if (!costCalc.rate || costCalc.rate === 0) return alert('請輸入有效匯率');
    
    const twdCost = Math.round(currentTwdCost);
    const profit = Math.round(costCalc.sellingPrice - twdCost);
    
    const entryData = {
      itemName: costCalc.itemName.trim(),
      currency: costCalc.currency,
      foreignPrice: costCalc.foreignPrice,
      rate: costCalc.rate,
      twdCost: twdCost,
      sellingPrice: costCalc.sellingPrice,
      profit: profit,
      createdAt: editingBookkeepingId ? bookkeepingRecords.find(r => r.id === editingBookkeepingId)?.createdAt || Date.now() : Date.now()
    };
    
    if (editingBookkeepingId) {
      await updateDoc(doc(db, 'bookkeeping', editingBookkeepingId), entryData);
    } else {
      await addDoc(collection(db, 'bookkeeping'), entryData);
    }
    
    cancelEditBookkeeping();
  };

  const loadBookkeepingForEdit = (record: BookkeepingEntry) => {
    setEditingBookkeepingId(record.id);
    const margin = record.twdCost > 0 ? ((record.sellingPrice / record.twdCost) - 1) * 100 : 0;
    setCostCalc({
      itemName: record.itemName,
      currency: record.currency,
      foreignPrice: record.foreignPrice,
      rate: record.rate,
      targetMargin: Math.round(margin * 10) / 10,
      sellingPrice: record.sellingPrice
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditBookkeeping = () => {
    setEditingBookkeepingId(null);
    setCostCalc({ itemName: '', currency: 'JPY', foreignPrice: 0, rate: 0, targetMargin: 0, sellingPrice: 0 });
  };

  const deleteBookkeeping = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (confirm('確定要刪除這筆紀錄嗎？')) {
      await deleteDoc(doc(db, 'bookkeeping', id));
      if (editingBookkeepingId === id) cancelEditBookkeeping();
    }
  };

  const openAddOrderModal = () => {
    setEditingOrderId(null);
    setNewOrder({
      customer: '',
      category: '一般',
      deliveryMethod: '未設定',
      items: [{ name: '', qty: 1, purchasedQty: 0, price: 0, cost: 0 }],
      status: { isPaid: false, isProcessed: false, isShipped: false }
    });
    setIsModalOpen(true);
  };

  const openEditOrderModal = (order: Order) => {
    setEditingOrderId(order.id);
    const sanitizedItems = order.items.map(item => ({
      ...item,
      purchasedQty: item.purchasedQty || 0
    }));
    setNewOrder({ ...order, items: sanitizedItems });
    setIsModalOpen(true);
  };

  const handleSaveOrder = async () => {
    if (!selectedOperator) return alert('請先選擇或新增操作人員');
    if (!newOrder.customer?.trim()) return alert('請輸入客戶名稱');
    
    const items = newOrder.items || [];
    const total = items.reduce((acc, i) => acc + (i.qty * i.price), 0);
    const isFullyPurchased = items.length > 0 && items.every(item => item.purchasedQty >= item.qty);
    
    let finalStatus = newOrder.status || { isPaid: false, isProcessed: false, isShipped: false };
    
    if (isFullyPurchased && !finalStatus.isShipped) {
      if (!finalStatus.isProcessed) {
        setToastMessage("🎉 該訂單所有商品已購齊！狀態已更換為『已處理』");
        setTimeout(() => setToastMessage(null), 3500);
      }
      finalStatus = { ...finalStatus, isProcessed: true };
    }

    const orderData = {
      customer: newOrder.customer,
      category: newOrder.category,
      deliveryMethod: newOrder.deliveryMethod,
      items: newOrder.items,
      status: finalStatus,
      totalAmount: total,
      addedBy: selectedOperator
    };

    try {
      if (editingOrderId) {
        await updateDoc(doc(db, 'orders', editingOrderId), { ...orderData, updatedAt: Date.now() });
      } else {
        await addDoc(collection(db, 'orders'), {
          ...orderData,
          createdAt: Date.now(),
          isDeleted: false
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving order:", error);
      alert("儲存失敗");
    }
  };

  const toggleStatus = async (orderId: string, field: keyof OrderStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    const isCurrentlyActive = order.status[field];
    const newStatus = {
      ...order.status,
      [field]: !isCurrentlyActive
    };
    
    await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
  };

  const moveOrderToTrash = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateDoc(doc(db, 'orders', id), { isDeleted: true });
  };

  const restoreOrder = async (id: string) => {
    await updateDoc(doc(db, 'orders', id), { isDeleted: false });
  };

  const permanentDeleteOrder = async (id: string) => {
    if (confirm('確定要永久刪除這筆訂單嗎？')) {
      await deleteDoc(doc(db, 'orders', id));
    }
  };

  const handleAddOperator = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newName = window.prompt('請輸入新的操作人員姓名:');
    if (newName && newName.trim()) {
      const trimmedName = newName.trim();
      
      setOperators(prev => {
        if (!prev.includes(trimmedName)) {
          const next = [...prev, trimmedName];
          return next;
        }
        return prev;
      });
      setSelectedOperator(trimmedName);
    }
  };

  const renderItemStatus = (item: OrderItem) => {
    if (item.purchasedQty === 0) return <Circle size={16} className="text-slate-200" />;
    if (item.purchasedQty >= item.qty) return <CheckCircle2 size={16} className="text-[#3EB075]" />;
    return (
      <span className="text-[10px] font-black bg-amber-50 text-amber-500 px-1.5 py-0.5 rounded-full border border-amber-100 whitespace-nowrap">
        {item.purchasedQty}/{item.qty}
      </span>
    );
  };

  const getShippingColor = (method: DeliveryMethod) => {
    switch(method) {
      case '免運': return 'bg-orange-500 border-orange-500 shadow-orange-500/20';
      case '面交': return 'bg-slate-700 border-slate-700 shadow-slate-700/20';
      case '郵寄':
      case '賣貨便': return 'bg-blue-600 border-blue-600 shadow-blue-600/20';
      default: return 'bg-slate-900 border-slate-900 shadow-slate-900/20';
    }
  };

  // 輔助函式：當選取下拉建議項時觸發
  const handleSelectSuggestion = (index: number, fullItemName: string) => {
    const match = bookkeepingRecords.find(r => r.itemName === fullItemName);
    setNewOrder(prev => {
      const newItems = [...(prev.items || [])];
      if (match) {
        newItems[index] = { 
          ...newItems[index], 
          name: fullItemName, 
          price: match.sellingPrice, 
          cost: match.twdCost 
        };
      } else {
        newItems[index] = { ...newItems[index], name: fullItemName };
      }
      return { ...prev, items: newItems };
    });
    setFocusedItemIndex(null);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen pb-32 bg-[#F8FAF9] text-slate-800 antialiased font-sans">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-slate-900 text-white rounded-[24px] p-4 flex items-center gap-3 shadow-2xl border border-white/10">
            <div className="bg-[#3EB075] p-2 rounded-xl">
              <BellRing size={20} className="text-white animate-bounce" />
            </div>
            <p className="text-sm font-black tracking-tight">{toastMessage}</p>
          </div>
        </div>
      )}

      {/* View: Orders (Dashboard) */}
      {activeTab === 'dashboard' && (
        <div className="p-4 space-y-4 animate-in fade-in duration-300">
          <header className="flex justify-between items-center py-2">
            <div className="flex items-center gap-2">
              <img src="cherry-logo.png" alt="logo" className="w-10 h-10 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <h1 className="text-2xl font-black tracking-tighter uppercase italic text-slate-900">Cherry Buy Buy</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsTrashOpen(true)} className="p-2.5 bg-white rounded-2xl shadow-sm text-slate-400 active:scale-90 transition-transform border border-slate-100 relative">
                <Trash2 size={22} strokeWidth={2.5} />
                {trashOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                    {trashOrders.length}
                  </span>
                )}
              </button>
              <button onClick={() => setIsSearchOpen(true)} className="p-2.5 bg-white rounded-2xl shadow-sm text-slate-600 active:scale-90 transition-transform border border-slate-100">
                <Search size={22} strokeWidth={2.5} />
              </button>
            </div>
          </header>

          <section className="bg-slate-900 rounded-[32px] p-7 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-[-20px] right-[-20px] opacity-10 rotate-12">
              <Package size={200} />
            </div>
            <p className="text-[10px] font-black opacity-50 mb-1 flex items-center gap-2 tracking-[0.2em] uppercase">
              <LayoutDashboard size={12} strokeWidth={3} /> 總累計銷售額
            </p>
            <h2 className="text-5xl font-black tracking-tighter mb-5">NT$ {totalSales.toLocaleString()}</h2>
            <div className="flex items-center gap-3">
              <div className="bg-[#3EB075] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg shadow-green-500/20">待收款</div>
              <p className="text-lg font-black tracking-tight">NT$ {pendingIncome.toLocaleString()}</p>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <StatCard title="待處理" value={untreatedCount} colorClass="bg-white text-[#3EB075]" subtitle={`${untreatedCount} 訂單需採購`} />
            <StatCard title="已處理" value={processedCount} colorClass="bg-white text-indigo-500" subtitle="採購進度穩定" />
            <StatCard title="未出貨" value={activeOrders.filter(o => !o.status.isShipped).length} colorClass="bg-white text-orange-500" />
            <StatCard title="已出貨" value={activeOrders.filter(o => o.status.isShipped).length} colorClass="bg-white text-slate-400" />
          </div>

          <div className="space-y-4 mt-6">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 px-1">進行中訂單</h4>
            {activeOrders.length === 0 ? (
              <div className="py-20 text-center opacity-20">
                <Package size={48} className="mx-auto mb-3" />
                <p className="text-sm font-black uppercase tracking-widest italic">目前尚無訂單</p>
              </div>
            ) : (
              activeOrders.map(order => (
                <div 
                  key={order.id} 
                  onClick={() => openEditOrderModal(order)}
                  className="bg-white rounded-[28px] p-5 shadow-sm border border-slate-100 space-y-4 animate-in slide-in-from-bottom duration-300 active:scale-[0.98] transition-transform"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <span className="text-[9px] font-black bg-slate-100 px-2.5 py-1 rounded-full text-slate-500 uppercase tracking-wider">{order.category}</span>
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${order.deliveryMethod === '未設定' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>{order.deliveryMethod}</span>
                        {order.addedBy && (
                          <span className="text-[9px] font-black bg-slate-900 text-white px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <UserCheck size={10} /> {order.addedBy}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <User size={14} className="text-slate-300" /> {order.customer}
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-slate-900 leading-none">NT${order.totalAmount.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{new Date(order.createdAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-3 flex justify-between items-center">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-600 truncate">
                        {order.items.map(i => `${i.name || '項目'}x${i.qty}`).join(', ')}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => moveOrderToTrash(order.id, e)} 
                      className="p-2.5 bg-white rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all border border-slate-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={(e) => toggleStatus(order.id, 'isPaid', e)} 
                      className={`flex-1 h-11 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${order.status.isPaid ? 'bg-[#3EB075] text-white border-[#3EB075] shadow-md' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>已付款</button>
                    <button onClick={(e) => toggleStatus(order.id, 'isProcessed', e)} 
                      className={`flex-1 h-11 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${order.status.isProcessed ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>已處理</button>
                    <button onClick={(e) => toggleStatus(order.id, 'isShipped', e)} 
                      className={`flex-1 h-11 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${order.status.isShipped ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>已出貨</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* View: Bookkeeping */}
      {activeTab === 'bookkeeping' && (
        <div className="p-4 space-y-6 animate-in fade-in duration-300">
           <div className="px-1 flex justify-between items-end">
             <div>
               <h1 className="text-2xl font-black tracking-tighter uppercase italic text-[#FF4D6D] flex items-center gap-2">
                 <Cherry size={28} className="fill-[#FF4D6D]" /> {editingBookkeepingId ? '修改紀錄' : '櫻桃採購利潤'}
               </h1>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pricing & Profit Analysis</p>
             </div>
             {editingBookkeepingId && (
               <button onClick={cancelEditBookkeeping} className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1 border-b border-red-200">取消編輯</button>
             )}
           </div>
           
           <div className={`bg-white rounded-[32px] p-6 shadow-sm border space-y-6 transition-all duration-300 ${editingBookkeepingId ? 'border-[#FF4D6D] ring-4 ring-[#FF4D6D]/5' : 'border-slate-100'}`}>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 tracking-widest">商品名稱</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    type="text" 
                    value={costCalc.itemName}
                    onChange={e => setCostCalc(prev => ({...prev, itemName: e.target.value}))}
                    className="w-full h-14 text-sm font-bold bg-slate-50 text-slate-900 rounded-[20px] px-4 py-3 pl-11 outline-none border border-transparent focus:border-slate-200 transition-all"
                    placeholder="輸入商品名稱"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">幣別選擇</label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {currencies.map(curr => (
                    <button
                      key={curr}
                      onClick={() => setCostCalc(prev => ({...prev, currency: curr}))}
                      className={`h-11 px-5 rounded-2xl text-[11px] font-black transition-all border whitespace-nowrap ${
                        costCalc.currency === curr 
                        ? 'bg-[#FF4D6D] text-white border-[#FF4D6D] shadow-xl shadow-red-500/10' 
                        : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 tracking-widest">採購外幣 ({costCalc.currency})</label>
                  <input 
                    type="number" 
                    value={costCalc.foreignPrice || ''}
                    onChange={e => setCostCalc(prev => ({...prev, foreignPrice: Number(e.target.value)}))}
                    className="w-full h-14 bg-slate-50 text-slate-900 rounded-[20px] px-4 py-3 outline-none text-base font-black"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 tracking-widest">匯率 (兌台幣)</label>
                  <input 
                    type="number" 
                    step="0.001"
                    value={costCalc.rate || ''}
                    onChange={e => setCostCalc(prev => ({...prev, rate: Number(e.target.value)}))}
                    className="w-full h-14 bg-slate-50 text-slate-900 rounded-[20px] px-4 py-3 outline-none text-base font-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-stretch">
                <div className="flex flex-col">
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 tracking-widest">目標利潤 (%)</label>
                  <input 
                    type="number" 
                    value={costCalc.targetMargin || ''}
                    onChange={e => setCostCalc(prev => ({...prev, targetMargin: Number(e.target.value)}))}
                    className="w-full h-16 bg-slate-50 text-slate-900 rounded-[20px] px-4 py-3 outline-none text-base font-black border border-transparent focus:ring-2 ring-red-500/10"
                    placeholder="%"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-black text-indigo-400 uppercase block mb-1.5 tracking-widest">建議售價 (TWD)</label>
                  <div className="h-16 bg-indigo-50/50 rounded-[20px] px-4 flex flex-col justify-center border border-indigo-100/50">
                    <p className="text-sm font-black text-indigo-700">NT$ {Math.round(recommendedPrice).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-indigo-500 uppercase block mb-1.5 tracking-widest font-bold">最終定價 (TWD)</label>
                <input 
                  type="number" 
                  value={costCalc.sellingPrice || ''}
                  onChange={e => setCostCalc(prev => ({...prev, sellingPrice: Number(e.target.value)}))}
                  className="w-full h-14 bg-white text-slate-900 rounded-[20px] px-4 py-3 outline-none text-base font-black ring-2 ring-indigo-500/20 border-2 border-indigo-100 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="pt-4 grid grid-cols-2 gap-4">
               <div className="p-4 rounded-[24px] bg-slate-50 text-center border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">台幣成本</p>
                  <p className="text-lg font-black text-slate-900">NT$ {Math.round(currentTwdCost).toLocaleString()}</p>
               </div>
               <div className={`p-4 rounded-[24px] text-center border ${costCalc.sellingPrice - currentTwdCost >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                  <p className="text-[9px] font-black opacity-50 uppercase mb-1 tracking-widest">預估利潤</p>
                  <p className={`text-lg font-black ${costCalc.sellingPrice - currentTwdCost >= 0 ? 'text-[#3EB075]' : 'text-red-600'}`}>
                    NT$ {Math.round(costCalc.sellingPrice - currentTwdCost).toLocaleString()}
                  </p>
               </div>
            </div>

            <button 
              onClick={handleSaveBookkeeping}
              className={`w-full h-14 text-white rounded-[20px] font-black text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2 ${editingBookkeepingId ? 'bg-[#FF4D6D]' : 'bg-slate-900'}`}
            >
              <Zap size={18} strokeWidth={2.5} /> {editingBookkeepingId ? '更新紀錄' : '儲存紀錄'}
            </button>
          </div>

          <div className="space-y-4 pb-24">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] px-1">歷史採購</h4>
            <div className="space-y-3">
              {bookkeepingRecords.map(record => (
                <div 
                  key={record.id} 
                  onClick={() => loadBookkeepingForEdit(record)}
                  className={`bg-white rounded-[24px] p-4 shadow-sm border flex justify-between items-center transition-all active:scale-95 hover:border-[#FF4D6D] ${editingBookkeepingId === record.id ? 'border-[#FF4D6D] bg-red-50/30' : 'border-slate-100'}`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="font-black text-slate-900 text-sm">{record.itemName}</h5>
                      <span className="text-[8px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 font-black uppercase tracking-wider">1:{record.rate} {record.currency}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      成本: NT${Math.round(record.twdCost).toLocaleString()} / 售價: NT${record.sellingPrice.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                     <div>
                       <p className={`text-base font-black ${record.profit >= 0 ? 'text-[#3EB075]' : 'text-red-500'}`}>{record.profit >= 0 ? '+' : ''}{record.profit.toLocaleString()}</p>
                       <p className="text-[8px] text-slate-300 font-black uppercase tracking-widest">利潤</p>
                     </div>
                     <button onClick={(e) => deleteBookkeeping(record.id, e)} className="p-2.5 bg-slate-50 rounded-xl text-slate-200 hover:text-red-500 transition-all">
                       <Trash2 size={18} />
                     </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recycle Bin Modal */}
      {isTrashOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 pb-4 flex justify-between items-center border-b border-slate-50">
               <h3 className="text-2xl font-black text-red-500 tracking-tighter uppercase italic">回收桶</h3>
               <button onClick={() => setIsTrashOpen(false)} className="p-3 bg-slate-50 rounded-2xl text-slate-400"><X size={24}/></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4 scrollbar-hide">
              {trashOrders.length === 0 ? (
                <p className="text-center py-20 text-slate-300 font-black uppercase italic">回收桶是空的</p>
              ) : (
                trashOrders.map(order => (
                  <div key={order.id} className="bg-slate-50 rounded-[28px] p-5 border border-slate-100 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 pr-4">
                        <span className="text-[9px] font-black bg-white px-2 py-0.5 rounded-full text-slate-400 uppercase mb-1 inline-block">{order.customer}</span>
                        <h4 className="font-black text-slate-700 text-sm truncate">{order.items.map(i => i.name).join(', ')}</h4>
                      </div>
                      <p className="text-sm font-black text-slate-900">NT${order.totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => restoreOrder(order.id)} className="flex-1 h-10 bg-white text-[#3EB075] rounded-xl text-[10px] font-black uppercase border border-[#E4F7ED] flex items-center justify-center gap-2">
                         <RotateCcw size={14} /> 還原
                       </button>
                       <button onClick={() => permanentDeleteOrder(order.id)} className="h-10 px-4 bg-red-50 text-red-500 rounded-xl text-[10px] font-black">永久刪除</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-white z-[60] animate-in slide-in-from-top duration-400 p-4">
            <div className="flex items-center gap-4 mb-4 sticky top-0 bg-white z-10 py-4 border-b border-slate-50">
              <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="p-3 bg-slate-100 rounded-2xl text-slate-500"><X size={24}/></button>
              <div className="flex-1 relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full h-14 bg-slate-50 rounded-[24px] pl-14 pr-6 py-4 outline-none font-black text-sm text-slate-900 shadow-sm" placeholder="搜尋客戶、商品..." />
              </div>
            </div>

            {/* 產品匯總分析統計欄位 */}
            {searchStats && (
              <div className="mb-6 grid grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300">
                <div className="bg-[#FF4D6D]/5 border border-[#FF4D6D]/10 rounded-[28px] p-5 flex items-center gap-4">
                  <div className="bg-[#FF4D6D] p-3 rounded-2xl text-white shadow-lg shadow-red-500/20">
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">總需求量</p>
                    <p className="text-xl font-black text-[#FF4D6D]">{searchStats.totalQty} <span className="text-[10px] opacity-60 ml-0.5">件</span></p>
                  </div>
                </div>
                <div className="bg-[#3EB075]/5 border border-[#3EB075]/10 rounded-[28px] p-5 flex items-center gap-4">
                  <div className="bg-[#3EB075] p-3 rounded-2xl text-white shadow-lg shadow-green-500/20">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">訂購客戶</p>
                    <p className="text-xl font-black text-[#3EB075]">{searchStats.customerCount} <span className="text-[10px] opacity-60 ml-0.5">位</span></p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 pb-10 overflow-y-auto max-h-[70vh] scrollbar-hide">
              {filteredOrders.length === 0 && searchQuery.trim() !== '' ? (
                <div className="py-20 text-center opacity-20">
                  <Search size={48} className="mx-auto mb-3" />
                  <p className="text-sm font-black uppercase tracking-widest italic">找不到匹配結果</p>
                </div>
              ) : (
                filteredOrders.map(order => (
                  <div key={order.id} onClick={() => { setIsSearchOpen(false); openEditOrderModal(order); }} className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 flex justify-between items-center group animate-in fade-in transition-all active:scale-95">
                    <div className="space-y-2 flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                         <span className="text-[9px] font-black bg-red-50 text-[#FF4D6D] px-2 py-0.5 rounded-full uppercase">{order.customer}</span>
                         <span className="text-[10px] font-black text-slate-300 uppercase">NT${order.totalAmount.toLocaleString()}</span>
                         <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${order.status.isShipped ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                           {order.status.isShipped ? '已出貨' : '未出貨'}
                         </span>
                      </div>
                      <h3 className="font-black text-slate-900 text-base truncate">{order.items.map(i => `${i.name}x${i.qty}`).join(', ')}</h3>
                    </div>
                    <ChevronRight size={20} className="text-slate-200 group-hover:text-[#FF4D6D] transition-colors" />
                  </div>
                ))
              )}
            </div>
        </div>
      )}

      {/* Action: Add Order Button */}
      <button 
        onClick={openAddOrderModal} 
        className="fixed bottom-24 right-6 w-16 h-16 bg-slate-900 text-white rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-center hover:scale-110 active:scale-90 transition-all z-40 border-4 border-white"
      >
        <Plus size={32} strokeWidth={3} />
      </button>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 safe-bottom z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-20">
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'dashboard' ? 'text-[#3EB075] scale-110' : 'text-slate-300'}`}>
            <LayoutDashboard size={24} strokeWidth={activeTab === 'dashboard' ? 3 : 2} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">訂單</span>
          </button>
          <button onClick={() => setActiveTab('bookkeeping')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'bookkeeping' ? 'text-[#FF4D6D] scale-110' : 'text-slate-300'}`}>
            <Cherry size={24} strokeWidth={activeTab === 'bookkeeping' ? 3 : 2} className={activeTab === 'bookkeeping' ? 'fill-[#FF4D6D]' : ''} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">採購分析</span>
          </button>
        </div>
      </nav>

      {/* Order Modal (Add/Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-[48px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-400 my-auto">
            <div className="p-8 pb-4 flex justify-between items-center">
               <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">{editingOrderId ? '更新訂單' : '新增訂單'}</h3>
               <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-2xl text-slate-400"><X size={24}/></button>
            </div>
            
            <div className="p-8 pt-4 max-h-[65vh] overflow-y-auto space-y-6 scrollbar-hide">
               {/* Operator Selection */}
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-3 tracking-widest px-1">操作人員 (Operator)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {operators.map(name => (
                      <button
                        key={name}
                        onClick={() => setSelectedOperator(name)}
                        className={`h-11 rounded-2xl text-[10px] font-black uppercase transition-all border ${
                          selectedOperator === name 
                          ? 'bg-slate-900 text-white shadow-lg border-slate-900' 
                          : 'bg-white text-slate-400 border-slate-100'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={(e) => handleAddOperator(e)}
                      className="h-11 rounded-2xl text-[10px] font-black uppercase border border-dashed border-slate-200 text-slate-400 flex items-center justify-center gap-1 hover:bg-slate-50 active:scale-95 transition-all"
                    >
                      <Plus size={12} /> 新增
                    </button>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 tracking-widest">客戶姓名 (Buyer)</label>
                    <input type="text" value={newOrder.customer} onChange={e => setNewOrder(prev => ({...prev, customer: e.target.value}))} className="w-full h-14 bg-slate-50 text-slate-900 rounded-[20px] px-4 outline-none text-sm font-bold border border-transparent focus:border-slate-200" placeholder="買家姓名" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 tracking-widest">分類</label>
                    <select value={newOrder.category} onChange={e => setNewOrder(prev => ({...prev, category: e.target.value as Category}))} className="w-full h-14 bg-slate-50 text-slate-900 rounded-[20px] px-4 outline-none text-sm font-bold appearance-none">
                      <option>一般</option><option>食品</option><option>服飾</option><option>服務</option>
                    </select>
                  </div>
               </div>

               {/* Status Selection In Modal */}
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase block mb-3 tracking-widest text-center">訂單狀態</label>
                 <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => setNewOrder(prev => ({...prev, status: { ...prev.status, isPaid: !prev.status?.isPaid }}))} 
                      className={`h-11 rounded-2xl text-[10px] font-black uppercase transition-all border ${newOrder.status?.isPaid ? 'bg-[#3EB075] text-white border-[#3EB075] shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>已付款</button>
                    <button onClick={() => setNewOrder(prev => ({...prev, status: { ...prev.status, isProcessed: !prev.status?.isProcessed }}))} 
                      className={`h-11 rounded-2xl text-[10px] font-black uppercase transition-all border ${newOrder.status?.isProcessed ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>已處理</button>
                    <button onClick={() => setNewOrder(prev => ({...prev, status: { ...prev.status, isShipped: !prev.status?.isShipped }}))} 
                      className={`h-11 rounded-2xl text-[10px] font-black uppercase transition-all border ${newOrder.status?.isShipped ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>已出貨</button>
                 </div>
               </div>

               {/* Shipping Method Selection */}
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase block mb-3 tracking-widest text-center">寄送方式</label>
                 <div className="grid grid-cols-3 gap-2">
                    {(['未設定', '面交', '郵寄', '賣貨便', '免運'] as DeliveryMethod[]).map(method => {
                      const isActive = newOrder.deliveryMethod === method;
                      return (
                        <button 
                          key={method} 
                          onClick={() => setNewOrder(prev => ({...prev, deliveryMethod: method}))} 
                          className={`h-11 rounded-2xl text-[10px] font-black uppercase transition-all border flex items-center justify-center ${
                            isActive 
                            ? `${getShippingColor(method)} text-white shadow-lg` 
                            : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                          }`}
                        >
                          {method}
                        </button>
                      );
                    })}
                 </div>
               </div>

               <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase block tracking-widest flex items-center gap-1">
                      <ShoppingCart size={12} /> 訂購項目
                    </label>
                    <button onClick={() => setNewOrder(prev => ({...prev, items: [...(prev.items || []), { name: '', qty: 1, purchasedQty: 0, price: 0, cost: 0 }]}))} className="text-[10px] font-black text-[#3EB075] uppercase tracking-widest flex items-center gap-1 px-3 py-1.5 bg-[#E4F7ED] rounded-xl"><Plus size={14} /> 新增項目</button>
                  </div>
                  <div className="space-y-4">
                    {(newOrder.items || []).map((item, idx) => {
                      // 篩選對應項目的智慧建議
                      const currentVal = item.name.toLowerCase();
                      const suggestions = currentVal.trim() === '' 
                        ? [] 
                        : historyItemNames.filter(name => name.toLowerCase().includes(currentVal));
                      
                      return (
                        <div key={idx} className="bg-slate-50 p-5 rounded-[32px] flex flex-col gap-4 border border-slate-100 shadow-sm relative animate-in slide-in-from-right duration-300">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8">
                              {renderItemStatus(item as OrderItem)}
                            </div>
                            <div className="flex-1 space-y-1.5 relative">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                                項目名稱 {bookkeepingRecords.some(r => r.itemName.toLowerCase() === item.name.toLowerCase()) && <Zap size={8} className="text-amber-400 fill-amber-400" />}
                              </label>
                              <div className="relative">
                                <input 
                                  type="text" 
                                  autoComplete="off"
                                  value={item.name} 
                                  onFocus={() => setFocusedItemIndex(idx)}
                                  onBlur={() => {
                                    // 延遲隱藏，確保點選事件能觸發
                                    setTimeout(() => setFocusedItemIndex(null), 200);
                                  }}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setNewOrder(prev => {
                                      const newItems = [...(prev.items || [])];
                                      newItems[idx] = { ...newItems[idx], name: val };
                                      return { ...prev, items: newItems };
                                    });
                                  }} 
                                  className="w-full h-12 bg-white text-slate-900 rounded-2xl px-4 outline-none text-sm font-bold shadow-sm border border-slate-100 focus:border-indigo-200 transition-colors" 
                                  placeholder="輸入產品關鍵字" 
                                />
                                {/* 智慧下拉建議選單 */}
                                {focusedItemIndex === idx && suggestions.length > 0 && (
                                  <div 
                                    ref={suggestionRef}
                                    className="absolute left-0 right-0 top-[110%] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] max-h-[180px] overflow-y-auto scrollbar-hide py-2 animate-in fade-in slide-in-from-top-1"
                                  >
                                    {suggestions.map((name, sIdx) => (
                                      <button
                                        key={sIdx}
                                        onMouseDown={(e) => {
                                          e.preventDefault(); // 防止失去焦點
                                          handleSelectSuggestion(idx, name);
                                        }}
                                        className="w-full text-left px-5 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                                      >
                                        <p className="text-xs font-black text-slate-900 truncate">{name}</p>
                                        <p className="text-[8px] text-slate-300 font-bold uppercase tracking-widest">歷史採購品項</p>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                if ((newOrder.items || []).length > 1 || confirm('確定要移除此項目嗎？')) {
                                  setNewOrder(prev => ({
                                    ...prev,
                                    items: prev.items?.filter((_, i) => i !== idx)
                                  }));
                                }
                              }} 
                              className="p-3 bg-red-50 text-red-400 rounded-2xl active:bg-red-100 transition-colors shadow-sm"
                            >
                              <Trash2 size={20}/>
                            </button>
                          </div>
                          
                          <div className="flex flex-row items-start gap-4 flex-nowrap">
                             <div className="flex-1 space-y-1.5 min-w-0">
                               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 whitespace-nowrap">總數量 (Total)</label>
                               <div className="flex items-center bg-white rounded-2xl h-12 px-2 gap-2 shadow-sm border border-slate-100">
                                  <button onClick={() => {
                                    setNewOrder(prev => {
                                      const newItems = [...(prev.items || [])];
                                      if (newItems[idx].qty > 1) newItems[idx].qty--;
                                      return { ...prev, items: newItems };
                                    });
                                  }} className="text-slate-300 active:text-slate-600 transition-colors flex-shrink-0">
                                    <MinusCircle size={20} />
                                  </button>
                                  <span className="font-black text-[12px] flex-1 text-center">{item.qty}</span>
                                  <button onClick={() => {
                                    setNewOrder(prev => {
                                      const newItems = [...(prev.items || [])];
                                      newItems[idx].qty++;
                                      return { ...prev, items: newItems };
                                    });
                                  }} className="text-slate-400 active:text-slate-600 transition-colors flex-shrink-0">
                                    <PlusCircle size={20} />
                                  </button>
                               </div>
                             </div>

                             <div className="flex-1 space-y-1.5 min-w-0">
                               <div className="flex justify-between items-center px-1 overflow-hidden">
                                  <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest whitespace-nowrap">已購數量</label>
                                  {item.qty - item.purchasedQty > 0 && (
                                    <span className="text-[8px] font-black text-red-400 bg-red-50 px-1.5 rounded-full flex-shrink-0">-{item.qty - item.purchasedQty}</span>
                                  )}
                               </div>
                               <div className="flex items-center bg-amber-50/50 rounded-2xl h-12 px-2 gap-2 shadow-sm border border-amber-100">
                                  <button onClick={() => {
                                    setNewOrder(prev => {
                                      const newItems = [...(prev.items || [])];
                                      if (newItems[idx].purchasedQty > 0) newItems[idx].purchasedQty--;
                                      return { ...prev, items: newItems };
                                    });
                                  }} className="text-amber-200 active:text-amber-400 transition-colors flex-shrink-0">
                                    <MinusCircle size={20} />
                                  </button>
                                  <span className="font-black text-[12px] flex-1 text-center text-amber-600">{item.purchasedQty}</span>
                                  <button onClick={() => {
                                    setNewOrder(prev => {
                                      const newItems = [...(prev.items || [])];
                                      if (newItems[idx].purchasedQty < item.qty) newItems[idx].purchasedQty++;
                                      return { ...prev, items: newItems };
                                    });
                                  }} className="text-amber-400 active:text-amber-400 transition-colors flex-shrink-0">
                                    <PlusCircle size={20} />
                                  </button>
                               </div>
                             </div>
                          </div>

                          <div className="flex flex-row items-start gap-4 flex-nowrap">
                             <div className="flex-1 space-y-1.5 min-w-0">
                               <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest px-1 whitespace-nowrap">成本價 (Cost)</label>
                               <div className="relative h-12">
                                 <input 
                                   type="number" 
                                   value={item.cost || ''} 
                                   onChange={e => {
                                     const val = Number(e.target.value);
                                     setNewOrder(prev => {
                                       const newItems = [...(prev.items || [])];
                                       newItems[idx].cost = val;
                                       return { ...prev, items: newItems };
                                     });
                                   }} 
                                   className="w-full h-full bg-orange-50/30 text-slate-900 rounded-2xl px-3 pr-6 text-right font-black text-sm shadow-sm border border-orange-100/50 focus:border-orange-200" 
                                   placeholder="0" 
                                 />
                                 <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[7px] font-black text-orange-300 uppercase">NT</span>
                               </div>
                             </div>

                             <div className="flex-1 space-y-1.5 min-w-0">
                               <label className="text-[9px] font-black text-[#3EB075] uppercase tracking-widest px-1 whitespace-nowrap">定價 (Selling)</label>
                               <div className="relative h-12">
                                 <input 
                                   type="number" 
                                   value={item.price || ''} 
                                   onChange={e => {
                                     const val = Number(e.target.value);
                                     setNewOrder(prev => {
                                       const newItems = [...(prev.items || [])];
                                       newItems[idx].price = val;
                                       return { ...prev, items: newItems };
                                     });
                                   }} 
                                   className="w-full h-full bg-white text-slate-900 rounded-2xl px-3 pr-7 text-right font-black text-sm shadow-sm border border-slate-100 focus:border-indigo-200" 
                                   placeholder="0" 
                                 />
                                 <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[7px] font-black text-slate-300 uppercase">NT</span>
                               </div>
                             </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
               </div>
            </div>
            
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shadow-[0_-20px_50px_rgba(0,0,0,0.1)]">
               <div>
                 <p className="text-[10px] opacity-40 uppercase font-black tracking-widest">應收總額</p>
                 <h4 className="text-3xl font-black tracking-tighter italic">NT$ {newOrder.items?.reduce((acc, i) => acc + (i.price * i.qty), 0).toLocaleString()}</h4>
               </div>
               <button 
                 onClick={handleSaveOrder} 
                 className="bg-[#3EB075] px-10 py-4 rounded-[24px] font-black text-sm shadow-2xl shadow-green-500/30 active:scale-95 transition-all flex items-center gap-2"
               >
                 確認儲存
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;