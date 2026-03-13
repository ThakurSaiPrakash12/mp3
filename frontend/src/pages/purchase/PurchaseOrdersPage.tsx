/**
 * PurchaseOrdersPage.tsx — Orchestrator replacing the monolithic PurchaseOrders.tsx.
 */

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/auth/AuthProvider';
import {
  Product, PurchaseOrder, PurchaseOrderDetail, PurchaseOrderItemPayload,
  purchaseOrdersApi, productsApi, Supplier, suppliersApi,
} from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getErrorMessage } from '@/utils/apiError';
import { PurchaseOrdersTable } from './PurchaseOrdersTable';
import { CreateOrderDialog, ViewOrderDialog, DraftItem } from './PurchaseOrderForm';

export default function PurchaseOrdersPage() {
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([
    { tempId: Date.now(), product_id: 0, quantity: 1, cost_price: 0 },
  ]);
  const [viewOrder, setViewOrder] = useState<PurchaseOrderDetail | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<number | null>(null);

  useWebSocket({ onStockUpdated: () => fetchOrders() });

  useEffect(() => { void Promise.all([fetchOrders(), fetchSuppliers(), fetchProducts()]); }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    try { const res = await purchaseOrdersApi.getAll(); setOrders(res.purchase_orders); }
    catch { toast.error('Failed to load purchase orders'); }
    finally { setIsLoading(false); }
  };

  const fetchSuppliers = async () => {
    try { const res = await suppliersApi.getAll(); setSuppliers(res.suppliers); }
    catch { console.error('Suppliers fetch error'); }
  };

  const fetchProducts = async () => {
    try { const res = await productsApi.getAll(1, 100); setProducts(res.products); }
    catch { console.error('Products fetch error'); }
  };

  const resetDialog = () => {
    setSelectedSupplierId('');
    setDraftItems([{ tempId: Date.now(), product_id: 0, quantity: 1, cost_price: 0 }]);
    setIsDialogOpen(false);
  };

  const updateDraftItem = (tempId: number, field: keyof PurchaseOrderItemPayload, value: number) => {
    setDraftItems((prev) => prev.map((item) => item.tempId === tempId ? { ...item, [field]: value } : item));
  };

  const addDraftItem = () => {
    setDraftItems((prev) => [...prev, { tempId: Date.now() + prev.length, product_id: 0, quantity: 1, cost_price: 0 }]);
  };

  const removeDraftItem = (tempId: number) => {
    setDraftItems((prev) => prev.length === 1 ? prev : prev.filter((item) => item.tempId !== tempId));
  };

  const handleCreateOrder = async () => {
    const supplierId = Number(selectedSupplierId);
    if (!supplierId) { toast.error('Please select a supplier'); return; }
    const items = draftItems.map(({ product_id, quantity, cost_price }) => ({ product_id, quantity, cost_price }));
    if (items.some((i) => i.product_id <= 0 || i.quantity <= 0 || i.cost_price < 0)) {
      toast.error('Please complete all purchase items'); return;
    }
    setIsSaving(true);
    try {
      await purchaseOrdersApi.create({ supplier_id: supplierId, items });
      toast.success('Purchase order created');
      resetDialog();
      await fetchOrders();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to create purchase order'));
    } finally { setIsSaving(false); }
  };

  const handleViewOrder = async (orderId: number) => {
    try { const detail = await purchaseOrdersApi.getById(orderId); setViewOrder(detail); setIsViewDialogOpen(true); }
    catch (err: unknown) { toast.error(getErrorMessage(err, 'Failed to load order details')); }
  };

  const handleUpdateStatus = async (orderId: number, statusValue: PurchaseOrder['status']) => {
    setIsUpdatingStatus(orderId);
    try {
      const result = await purchaseOrdersApi.updateStatus(orderId, statusValue);
      toast.success(statusValue === 'DELIVERED' && result.stock_updates.length > 0
        ? 'Purchase order delivered and stock updated'
        : `Order marked as ${statusValue}`);
      await fetchOrders();
      if (viewOrder?.id === orderId) await handleViewOrder(orderId);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to update status'));
    } finally { setIsUpdatingStatus(null); }
  };

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Purchase Orders</h1>
            <p className="text-sm text-muted-foreground">
              Create supplier orders and mark them delivered to replenish stock automatically
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchOrders}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
            {isAdmin && <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Create Order</Button>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Orders', value: orders.length },
            { label: 'Pending', value: orders.filter((o) => o.status === 'PENDING').length },
            { label: 'Approved', value: orders.filter((o) => o.status === 'APPROVED').length },
            { label: 'Delivered', value: orders.filter((o) => o.status === 'DELIVERED').length },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <PurchaseOrdersTable
          orders={orders} isLoading={isLoading} isAdmin={isAdmin}
          isUpdatingStatus={isUpdatingStatus}
          onView={handleViewOrder}
          onApprove={(id) => handleUpdateStatus(id, 'APPROVED')}
          onDeliver={(id) => handleUpdateStatus(id, 'DELIVERED')}
        />

        {/* Dialogs */}
        <CreateOrderDialog
          open={isDialogOpen} onOpenChange={setIsDialogOpen}
          suppliers={suppliers} products={products}
          selectedSupplierId={selectedSupplierId} draftItems={draftItems}
          isSaving={isSaving}
          onSupplierChange={setSelectedSupplierId}
          onUpdateItem={updateDraftItem} onAddItem={addDraftItem} onRemoveItem={removeDraftItem}
          onSubmit={handleCreateOrder} onCancel={resetDialog}
        />
        <ViewOrderDialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen} order={viewOrder} />
      </div>
    </AppLayout>
  );
}
