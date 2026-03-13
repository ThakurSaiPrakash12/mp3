/**
 * ProductsTable.tsx — Paginated product table with status badges.
 */

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Package, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { Product, PaginationInfo } from '@/services/api';

interface ProductsTableProps {
  products: Product[];
  pagination: PaginationInfo | null;
  currentPage: number;
  isLoading: boolean;
  isAdmin: boolean;
  onPageChange: (page: number) => void;
  onAddStock: (product: Product) => void;
}

function StatusBadge({ status }: { status: Product['status'] }) {
  switch (status) {
    case 'OUT_OF_STOCK':
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Out of Stock</Badge>;
    case 'CRITICAL':
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Critical</Badge>;
    case 'LOW':
      return <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-600">Low Stock</Badge>;
    default:
      return <Badge variant="secondary">OK</Badge>;
  }
}

export function ProductsTable({
  products, pagination, currentPage, isLoading, isAdmin, onPageChange, onAddStock,
}: ProductsTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">No products found</p>
            {isAdmin && (
              <Button asChild className="mt-4">
                <Link to="/products/add">Add your first product</Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Min Stock</TableHead>
                  <TableHead className="text-right">Lead Time</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className={cn('text-right', product.reorder_required && 'text-destructive font-medium')}>
                      {product.stock}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{product.min_stock}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{product.lead_time} days</TableCell>
                    <TableCell><StatusBadge status={product.status} /></TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          variant={product.status === 'CRITICAL' || product.status === 'OUT_OF_STOCK' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => onAddStock(product)}
                        >
                          <RefreshCw className="mr-2 h-3 w-3" />Add Stock
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {products.length} of {pagination.total} products
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">Page {currentPage} of {pagination.pages}</span>
                  <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === pagination.pages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
