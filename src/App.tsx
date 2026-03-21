import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import Index from "./pages/Index";
import ArticlePage from "./pages/ArticlePage";
import ArticlesPage from "./pages/ArticlesPage";
import SubmitPage from "./pages/SubmitPage";
import DocsPage from "./pages/DocsPage";
import NotFound from "./pages/NotFound";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import CookiesPage from "./pages/CookiesPage";
import FAQPage from "./pages/FAQPage";
import DashboardPage from "./pages/DashboardPage";
import PricingPage from "./pages/PricingPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import CommentsPage from "./pages/CommentsPage";
import UnsubscribePage from "./pages/UnsubscribePage";

// Error boundary to prevent WebMCP from crashing the app
class WebMCPErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("WebMCP failed to load:", error.message);
  }
  render() { return this.state.hasError ? null : this.props.children; }
}

const WebMCPProvider = lazy(() =>
  import("./components/WebMCPProvider").catch(() => ({
    default: () => null as any,
  }))
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WebMCPErrorBoundary>
        <Suspense fallback={null}><WebMCPProvider /></Suspense>
      </WebMCPErrorBoundary>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/s/:slug" element={<ArticlePage />} />
          <Route path="/a/:id" element={<ArticlePage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/cookies" element={<CookiesPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/payment-success" element={<PaymentSuccessPage />} />
          <Route path="/comments" element={<CommentsPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
