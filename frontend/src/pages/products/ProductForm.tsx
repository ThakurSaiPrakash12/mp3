/**
 * ProductForm.tsx — Add-stock + CSV-upload dialogs used in the Products page.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Upload, RefreshCw } from 'lucide-react';
import { Product } from '@/services/api';
import { getErrorMessage } from '@/utils/apiError';
import { productsApi } from '@/services/productApi';
import { toast } from 'sonner';

// ── CSV Upload Dialog ─────────────────────────────────────────────────────────

interface CsvUploadDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export function CsvUploadDialog({ open, onOpenChange, onSuccess }: CsvUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) { toast.error('Please select a CSV file'); return; }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) { toast.error('Please select a file first'); return; }
    setIsUploading(true);
    try {
      const result = await productsApi.uploadCSV(selectedFile);
      if (result.inserted > 0) toast.success(`Successfully uploaded ${result.inserted} product(s)`);
      if (result.skipped > 0) toast.info(`Skipped ${result.skipped} duplicate product(s)`);
      if (result.updated > 0) toast.success(`Updated ${result.updated} existing product(s)`);
      result.errors?.forEach((e: { row: number; error: string }) => toast.error(`Row ${e.row}: ${e.error}`));
      onOpenChange(false);
      setSelectedFile(null);
      onSuccess();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to upload CSV file'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Products CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import products. The CSV must have headers: name, stock, min_stock, lead_time
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <input
            type="file" accept=".csv" onChange={handleFileChange} disabled={isUploading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer cursor-pointer"
          />
          {selectedFile && <div className="text-sm text-muted-foreground">Selected: {selectedFile.name}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setSelectedFile(null); }} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
            {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : <><Upload className="mr-2 h-4 w-4" />Upload</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add-stock Dialog ──────────────────────────────────────────────────────────

interface AddStockDialogProps {
  open: boolean;
  product: Product | null;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export function AddStockDialog({ open, product, onOpenChange, onSuccess }: AddStockDialogProps) {
  const [stockValue, setStockValue] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!product || !stockValue) { toast.error('Please enter a valid stock quantity'); return; }
    const qty = parseInt(stockValue, 10);
    if (isNaN(qty) || qty <= 0) { toast.error('Stock must be a positive number'); return; }
    setIsResetting(true);
    try {
      const res = await productsApi.reorderReset(product.id, qty);
      toast.success(`Stock added: ${res.previous_stock} + ${qty} = ${res.current_stock}`);
      onOpenChange(false);
      setStockValue('');
      onSuccess();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to reset stock'));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Stock — Reorder Replenishment</DialogTitle>
          <DialogDescription>
            {product && <>Add stock to <strong>{product.name}</strong>. Current stock: {product.stock}</>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="new-stock-qty">Quantity to Add</Label>
            <Input
              id="new-stock-qty" type="number" min="1"
              placeholder="Enter quantity to add to current stock"
              value={stockValue} onChange={(e) => setStockValue(e.target.value)}
              disabled={isResetting} className="mt-2"
            />
            <p className="mt-2 text-xs text-muted-foreground">This will ADD to the current stock (not replace it).</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setStockValue(''); }} disabled={isResetting}>
            Cancel
          </Button>
          <Button onClick={handleReset} disabled={!stockValue || isResetting}>
            {isResetting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding Stock...</> : <><RefreshCw className="mr-2 h-4 w-4" />Add Stock</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
