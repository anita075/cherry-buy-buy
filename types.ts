export type Category = '一般' | '免運';
export type DeliveryMethod = '未設定' | '面交' | '郵寄' | '賣貨便';
export type PaymentType = '現金' | 'VISA' | 'JCB';
export type CurrencyType = 'JPY' | 'KRW' | 'USD' | 'EUR' | 'TWD';

export interface ExchangeRate {
  id: string;
  date: string; // YYYY-MM-DD
  currency: CurrencyType;
  cash: number;
  visa: number;
  jcb: number;
  createdAt: number;
  updatedAt?: number;
}

export interface PurchaseRecord {
  qty: number;
  rate: number;
  foreignPrice: number;
  paymentType: PaymentType;
  date: string;
}

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
  cost: number;
  paymentType: PaymentType;
  purchases: PurchaseRecord[];
}

export interface OrderStatus {
  isPaid: boolean;
  isProcessed: boolean;
  isShipped: boolean;
}

export interface Order {
  id: string;
  customer: string;
  category: Category;
  deliveryMethod: DeliveryMethod;
  shippingFee: number;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt?: number;
  isDeleted?: boolean;
  isArchived?: boolean;
  addedBy?: string;
}

export interface MasterProduct {
  id: string;
  name: string;
  suggestedPrice: number;
  createdAt: number;
}

export interface BookkeepingEntry {
  id: string;
  itemName: string;
  currency: string;
  foreignPrice: number;
  rate: number;
  twdCost: number;
  sellingPrice: number;
  profit: number;
  createdAt: number;
}