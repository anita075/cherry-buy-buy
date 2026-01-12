export type Category = '一般' | '服務' | '食品' | '服飾';
export type DeliveryMethod = '未設定' | '面交' | '郵寄' | '賣貨便' | '免運';

export interface OrderItem {
  name: string;
  qty: number;
  purchasedQty: number; // New: Tracking how many items have been bought
  price: number;
  cost: number;
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
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt?: number;
  isDeleted?: boolean;
  addedBy?: string;
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