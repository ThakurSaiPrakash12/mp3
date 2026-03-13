import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi, Supplier, suppliersApi } from '@/services/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CreateProductForm {
  name: string;
  stock: number;
  min_stock: number;
  lead_time: number;
  supplier_id: number | null;
  cost_price: number | null;
  selling_price: number | null;
}

export default function AddProduct() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [formData, setFormData] = useState<CreateProductForm>({
    name: '',
    stock: 0,
    min_stock: 0,
    lead_time: 1,
    supplier_id: null,
    cost_price: null,
    selling_price: null,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateProductForm, string>>>({});

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await suppliersApi.getAll();
        setSuppliers(response.suppliers);
      } catch (err) {
        console.error('Suppliers fetch error:', err);
      } finally {
        setIsLoadingSuppliers(false);
      }
    };

    void fetchSuppliers();
  }, []);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CreateProductForm, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Product name must be less than 100 characters';
    }

    if (formData.stock < 0) {
      newErrors.stock = 'Stock cannot be negative';
    }

    if (formData.min_stock < 0) {
      newErrors.min_stock = 'Minimum stock cannot be negative';
    }

    if (formData.lead_time < 1) {
      newErrors.lead_time = 'Lead time must be at least 1 day';
    }

    if (formData.cost_price !== null && formData.cost_price < 0) {
      newErrors.cost_price = 'Cost price cannot be negative';
    }

    if (formData.selling_price !== null && formData.selling_price < 0) {
      newErrors.selling_price = 'Selling price cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!validate()) return;

    setIsLoading(true);
    
    try {
      await productsApi.create({
        ...formData,
        name: formData.name.trim(),
        supplier_id: formData.supplier_id,
        cost_price: formData.cost_price,
        selling_price: formData.selling_price,
      });
      setSuccess(true);
      setTimeout(() => navigate('/products'), 1500);
    } catch (err) {
      const apiError = err as { message?: string };
      setError(apiError.message || 'Failed to add product. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof CreateProductForm, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Add Product</h1>
            <p className="text-sm text-muted-foreground">
              Create a new product in your inventory
            </p>
          </div>
        </div>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
            <CardDescription>
              Enter the information for the new product
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Product added successfully! Redirecting...
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter product name"
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stock">Initial Stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => handleChange('stock', parseInt(e.target.value) || 0)}
                    className={errors.stock ? 'border-destructive' : ''}
                  />
                  {errors.stock && (
                    <p className="text-xs text-destructive">{errors.stock}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_stock">Minimum Stock</Label>
                  <Input
                    id="min_stock"
                    type="number"
                    min="0"
                    value={formData.min_stock}
                    onChange={(e) => handleChange('min_stock', parseInt(e.target.value) || 0)}
                    className={errors.min_stock ? 'border-destructive' : ''}
                  />
                  {errors.min_stock && (
                    <p className="text-xs text-destructive">{errors.min_stock}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead_time">Lead Time (days)</Label>
                <Input
                  id="lead_time"
                  type="number"
                  min="1"
                  value={formData.lead_time}
                  onChange={(e) => handleChange('lead_time', parseInt(e.target.value) || 1)}
                  className={errors.lead_time ? 'border-destructive' : ''}
                />
                {errors.lead_time && (
                  <p className="text-xs text-destructive">{errors.lead_time}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Time required to restock this product
                </p>
              </div>

              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select
                  value={formData.supplier_id?.toString() || 'none'}
                  onValueChange={(value) => handleChange('supplier_id', value === 'none' ? null : parseInt(value, 10))}
                  disabled={isLoadingSuppliers}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No supplier</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cost_price">Cost Price</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cost_price ?? ''}
                    onChange={(e) => handleChange('cost_price', e.target.value === '' ? null : parseFloat(e.target.value))}
                    className={errors.cost_price ? 'border-destructive' : ''}
                  />
                  {errors.cost_price && <p className="text-xs text-destructive">{errors.cost_price}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="selling_price">Selling Price</Label>
                  <Input
                    id="selling_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.selling_price ?? ''}
                    onChange={(e) => handleChange('selling_price', e.target.value === '' ? null : parseFloat(e.target.value))}
                    className={errors.selling_price ? 'border-destructive' : ''}
                  />
                  {errors.selling_price && <p className="text-xs text-destructive">{errors.selling_price}</p>}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={isLoading || success}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? 'Adding...' : 'Add Product'}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to="/products">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
