/**
 * PurchaseOrderForm.tsx — Create PO dialog + View PO detail dialog.
 */

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Plus } from 'lucide-react';
import { Product, Supplier, PurchaseOrderDetail, PurchaseOrderItemPayload } from '@/services/api';
import { formatIndianCurrency } from '@/utils/currency';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DraftItem extends PurchaseOrderItemPayload {
  tempId: number;
}

// ── Create PO Dialog ──────────────────────────────────────────────────────────

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  suppliers: Supplier[];
  products: Product[];
  selectedSupplierId: string;
  draftItems: DraftItem[];
  isSaving: boolean;
  onSupplierChange: (v: string) => void;
  onUpdateItem: (tempId: number, field: keyof PurchaseOrderItemPayload, value: number) => void;
  onAddItem: () => void;
  onRemoveItem: (tempId: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function CreateOrderDialog({
  open, onOpenChange, suppliers, products, selectedSupplierId, draftItems,
  isSaving, onSupplierChange, onUpdateItem, onAddItem, onRemoveItem, onSubmit, onCancel,
}: CreateOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>Select a supplier and add the ordered products</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select value={selectedSupplierId} onValueChange={onSupplierChange}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {draftItems.map((item, index) => (
              <div key={item.tempId} className="grid gap-4 rounded-lg border p-4 md:grid-cols-[2fr_1fr_1fr_auto]">
                <div className="space-y-2">
                  <Label>Product {index + 1}</Label>
                  <Select
                    value={item.product_id ? item.product_id.toString() : ''}
                    onValueChange={(v) => onUpdateItem(item.tempId, 'product_id', Number(v))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number" min="1" value={item.quantity}
                    onChange={(e) => onUpdateItem(item.tempId, 'quantity', Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cost Price</Label>
                  <Input
                    type="number" min="0" step="0.01" value={item.cost_price}
                    onChange={(e) => onUpdateItem(item.tempId, 'cost_price', Number(e.target.value) || 0)}
                  />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={() => onRemoveItem(item.tempId)}>Remove</Button>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={onAddItem}>
              <Plus className="mr-2 h-4 w-4" />Add Item
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
          <Button onClick={onSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── View PO Dialog ────────────────────────────────────────────────────────────

interface ViewOrderDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: PurchaseOrderDetail | null;
}

export function ViewOrderDialog({ open, onOpenChange, order }: ViewOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{order ? `Purchase Order PO-${order.id}` : 'Purchase Order'}</DialogTitle>
          <DialogDescription>{order ? `${order.supplier_name} · ${order.status}` : 'Order details'}</DialogDescription>
        </DialogHeader>

        {order && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                { label: 'Status', value: order.status },
                { label: 'Items', value: order.item_count },
                { label: 'Quantity', value: order.total_quantity },
                { label: 'Total Cost', value: formatIndianCurrency(order.total_cost) },
              ].map(({ label, value }) => (
                <Card key={label}>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">{label}</div>
                    <div className="mt-1 font-semibold">{value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatIndianCurrency(item.cost_price)}</TableCell>
                    <TableCell className="text-right">{formatIndianCurrency(item.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
