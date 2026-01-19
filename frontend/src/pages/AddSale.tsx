import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Product, productsApi, salesApi } from '@/services/api';
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
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, Package } from 'lucide-react';

export default function AddSale() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ message: string; updatedStock: number } | null>(null);

  const [formData, setFormData] = useState({
    product_id: 0,
    quantity: 1,
  });

  const [errors, setErrors] = useState<{ product_id?: string; quantity?: string }>({});

  const selectedProduct = products.find((p) => p.id === formData.product_id);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await productsApi.getAll(1, 100);
      setProducts(response.products);
    } catch (err) {
      setError('Failed to load products');
      console.error('Products fetch error:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: { product_id?: string; quantity?: string } = {};

    if (!formData.product_id) {
      newErrors.product_id = 'Please select a product';
    }

    if (formData.quantity < 1) {
      newErrors.quantity = 'Quantity must be at least 1';
    }

    if (selectedProduct && formData.quantity > selectedProduct.stock) {
      newErrors.quantity = `Only ${selectedProduct.stock} units available`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(null);

    if (!validate()) return;

    setIsLoading(true);
    
    try {
      const response = await salesApi.create(formData);
      setSuccess({
        message: response.message,
        updatedStock: response.updated_stock,
      });
      setTimeout(() => navigate('/sales'), 2000);
    } catch (err) {
      const apiError = err as { message?: string };
      setError(apiError.message || 'Failed to record sale. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/sales">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Record Sale</h1>
            <p className="text-sm text-muted-foreground">
              Record a new sale and update stock levels
            </p>
          </div>
        </div>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Sale Details</CardTitle>
            <CardDescription>
              Select a product and enter the quantity sold
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingProducts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="flex flex-col gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {success.message}
                    </div>
                    <p className="text-xs">
                      Updated stock: {success.updatedStock} units remaining
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select
                    value={formData.product_id ? formData.product_id.toString() : ''}
                    onValueChange={(value) => {
                      setFormData((prev) => ({ ...prev, product_id: parseInt(value) }));
                      setErrors((prev) => ({ ...prev, product_id: undefined }));
                    }}
                  >
                    <SelectTrigger className={errors.product_id ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span>{product.name}</span>
                            <span className="text-muted-foreground">
                              ({product.stock} in stock)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.product_id && (
                    <p className="text-xs text-destructive">{errors.product_id}</p>
                  )}
                </div>

                {selectedProduct && (
                  <div className="rounded-lg bg-muted p-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Current Stock:</span>{' '}
                        <span className="font-medium">{selectedProduct.stock}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Min Stock:</span>{' '}
                        <span className="font-medium">{selectedProduct.min_stock}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max={selectedProduct?.stock || 999999}
                    value={formData.quantity}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        quantity: parseInt(e.target.value) || 0,
                      }));
                      setErrors((prev) => ({ ...prev, quantity: undefined }));
                    }}
                    className={errors.quantity ? 'border-destructive' : ''}
                  />
                  {errors.quantity && (
                    <p className="text-xs text-destructive">{errors.quantity}</p>
                  )}
                </div>

                {selectedProduct && formData.quantity > 0 && (
                  <div className="rounded-lg border border-dashed p-3">
                    <p className="text-sm text-muted-foreground">
                      After sale:{' '}
                      <span className="font-medium text-foreground">
                        {selectedProduct.stock - formData.quantity}
                      </span>{' '}
                      units remaining
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={isLoading || !!success || products.length === 0}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading ? 'Recording...' : 'Record Sale'}
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link to="/sales">Cancel</Link>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
