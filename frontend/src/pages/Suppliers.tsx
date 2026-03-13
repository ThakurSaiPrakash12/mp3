import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/auth/AuthProvider';
import { suppliersApi, Supplier, SupplierPayload } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2, Building2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/apiError';

const emptyForm: SupplierPayload = {
  name: '',
  phone: '',
  email: '',
  address: '',
};

function normalizeSupplierPayload(formData: SupplierPayload): SupplierPayload {
  return {
    name: formData.name.trim(),
    phone: formData.phone?.trim() || undefined,
    email: formData.email?.trim() || undefined,
    address: formData.address?.trim() || undefined,
  };
}

export default function Suppliers() {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierPayload>(emptyForm);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const response = await suppliersApi.getAll();
      setSuppliers(response.suppliers);
    } catch (error) {
      toast.error('Failed to load suppliers');
      console.error('Suppliers fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingSupplier(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    const payload = normalizeSupplierPayload(formData);

    setIsSaving(true);
    try {
      if (editingSupplier) {
        await suppliersApi.update(editingSupplier.id, payload);
        toast.success('Supplier updated');
      } else {
        await suppliersApi.create(payload);
        toast.success('Supplier created');
      }

      setIsDialogOpen(false);
      setEditingSupplier(null);
      setFormData(emptyForm);
      await fetchSuppliers();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to save supplier'));
      console.error('Supplier save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    setIsDeleteLoading(supplier.id);
    try {
      await suppliersApi.delete(supplier.id);
      toast.success('Supplier deleted');
      await fetchSuppliers();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to delete supplier'));
      console.error('Supplier delete error:', error);
    } finally {
      setIsDeleteLoading(null);
    }
  };

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
            <p className="text-sm text-muted-foreground">
              Manage supplier contacts and see which products they support
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchSuppliers}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {isAdmin && (
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Supplier
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Suppliers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{suppliers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">With Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{suppliers.filter((supplier) => supplier.products_supplied > 0).length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unassigned Suppliers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{suppliers.filter((supplier) => supplier.products_supplied === 0).length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Supplier Directory</CardTitle>
            <CardDescription>Contact details, supplied product count, and linked products</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : suppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No suppliers found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Products Supplied</TableHead>
                    <TableHead>Products</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{supplier.phone || 'No phone'}</div>
                          <div className="text-muted-foreground">{supplier.email || 'No email'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
                        {supplier.address || 'No address'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{supplier.products_supplied}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                        {supplier.product_names.length > 0 ? supplier.product_names.join(', ') : 'No linked products'}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(supplier)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isDeleteLoading === supplier.id}
                              onClick={() => handleDelete(supplier)}
                            >
                              {isDeleteLoading === supplier.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
              <DialogDescription>
                Maintain supplier contact information for purchasing and product assignment
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-name">Name</Label>
                <Input
                  id="supplier-name"
                  value={formData.name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Supplier name"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="supplier-phone">Phone</Label>
                  <Input
                    id="supplier-phone"
                    value={formData.phone || ''}
                    onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier-email">Email</Label>
                  <Input
                    id="supplier-email"
                    value={formData.email || ''}
                    onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="Email address"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-address">Address</Label>
                <textarea
                  id="supplier-address"
                  value={formData.address || ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Business address"
                  className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingSupplier ? 'Save Changes' : 'Create Supplier'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
