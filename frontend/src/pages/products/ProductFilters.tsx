/**
 * ProductFilters.tsx — Search bar + CSV upload controls for the Products page.
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Upload, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProductFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isAdmin: boolean;
  onOpenUpload: () => void;
}

export function ProductFilters({ searchQuery, onSearchChange, isAdmin, onOpenUpload }: ProductFiltersProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products by name..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          {isAdmin && (
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={onOpenUpload}>
                <Upload className="mr-2 h-4 w-4" />
                Upload CSV
              </Button>
              <Button asChild>
                <Link to="/products/add">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Link>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
