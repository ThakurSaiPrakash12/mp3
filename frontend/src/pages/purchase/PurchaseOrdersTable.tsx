/**
 * PurchaseOrdersTable.tsx — The PO list table with status badges + action buttons.
 */

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, PackageCheck, Eye, Truck } from 'lucide-react';
import { PurchaseOrder } from '@/services/api';
import { formatIndianCurrency } from '@/utils/currency';

const statusVariant: Record<PurchaseOrder['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  DELIVERED: 'default',
  CANCELLED: 'destructive',
};

interface PurchaseOrdersTableProps {
  orders: PurchaseOrder[];
  isLoading: boolean;
  isAdmin: boolean;
  isUpdatingStatus: number | null;
  onView: (orderId: number) => void;
  onApprove: (orderId: number) => void;
  onDeliver: (orderId: number) => void;
}

export function PurchaseOrdersTable({
  orders, isLoading, isAdmin, isUpdatingStatus, onView, onApprove, onDeliver,
}: PurchaseOrdersTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order List</CardTitle>
        <CardDescription>Track supplier orders, status, quantities, and delivery progress</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PackageCheck className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">No purchase orders found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">PO-{order.id}</TableCell>
                  <TableCell>{order.supplier_name}</TableCell>
                  <TableCell><Badge variant={statusVariant[order.status]}>{order.status}</Badge></TableCell>
                  <TableCell className="text-right">{order.item_count}</TableCell>
                  <TableCell className="text-right">{order.total_quantity}</TableCell>
                  <TableCell className="text-right">{formatIndianCurrency(order.total_cost)}</TableCell>
                  <TableCell>{new Date(order.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => onView(order.id)}>
                        <Eye className="mr-2 h-3.5 w-3.5" />View
                      </Button>
                      {isAdmin && order.status === 'PENDING' && (
                        <Button size="sm" variant="secondary" disabled={isUpdatingStatus === order.id} onClick={() => onApprove(order.id)}>
                          {isUpdatingStatus === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Approve'}
                        </Button>
                      )}
                      {isAdmin && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                        <Button size="sm" disabled={isUpdatingStatus === order.id} onClick={() => onDeliver(order.id)}>
                          <Truck className="mr-2 h-3.5 w-3.5" />Deliver
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
