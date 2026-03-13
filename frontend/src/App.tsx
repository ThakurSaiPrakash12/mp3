import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/products/ProductsPage";
import AddProduct from "./pages/AddProduct";
import Sales from "./pages/Sales";
import AddSale from "./pages/AddSale";
import ReorderStatus from "./pages/ReorderStatus";
import DemandForecast from "./pages/forecast/ForecastPage";
import Suppliers from "./pages/Suppliers";
import PurchaseOrders from "./pages/purchase/PurchaseOrdersPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <Products />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products/add"
              element={
                <ProtectedRoute requireAdmin>
                  <AddProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales"
              element={
                <ProtectedRoute>
                  <Sales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales/add"
              element={
                <ProtectedRoute requireAdmin>
                  <AddSale />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reorder"
              element={
                <ProtectedRoute>
                  <ReorderStatus />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forecast"
              element={
                <ProtectedRoute>
                  <DemandForecast />
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute>
                  <Suppliers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase-orders"
              element={
                <ProtectedRoute>
                  <PurchaseOrders />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
