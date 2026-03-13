import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  ShoppingCart, 
  BarChart3, 
  AlertTriangle, 
  LogOut,
  Plus,
  Menu,
  X,
  LayoutDashboard,
  Activity,
  Users,
  Truck
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/utils/cn';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/sales', label: 'Sales', icon: ShoppingCart },
  { path: '/suppliers', label: 'Suppliers', icon: Users },
  { path: '/purchase-orders', label: 'Purchase Orders', icon: Truck },
  { path: '/forecast', label: 'Demand Forecast', icon: Activity },
  { path: '/reorder', label: 'Reorder Status', icon: AlertTriangle },
];

const adminItems = [
  { path: '/products/add', label: 'Add Product', icon: Plus },
  { path: '/sales/add', label: 'Record Sale', icon: BarChart3 },
];

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar - Desktop */}
      <aside className="hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Package className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-semibold">Inventory</span>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/60">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="mb-2 mt-6 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/60">
                Admin Actions
              </div>
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3 px-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium">{user?.username}</p>
              <p className="text-xs capitalize text-sidebar-foreground/60">{user?.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Inventory</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-b bg-card p-4 lg:hidden">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              {isAdmin && adminItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{user?.username}</span>
                <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
                  {user?.role}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="container py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
