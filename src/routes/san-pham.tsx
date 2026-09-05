import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Phone, LogIn, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePublicCatalog } from "@/features/catalog/usePublicCatalog";
import { CatalogHero } from "@/features/catalog/CatalogHero";
import { CatalogFilterBar } from "@/features/catalog/CatalogFilterBar";
import { CatalogProductGrid } from "@/features/catalog/CatalogProductGrid";
import { CatalogProductTable } from "@/features/catalog/CatalogProductTable";
import { CatalogLoadMore } from "@/features/catalog/CatalogLoadMore";
import { ProductDetailModal } from "@/features/catalog/ProductDetailModal";
import { ContactConsultationModal } from "@/features/catalog/ContactConsultationModal";

export const Route = createFileRoute("/san-pham")({
  component: PublicCatalogPage,
});

export function PublicCatalogPage() {
  const { user } = useAuth();
  const {
    loading,
    products,
    filteredProducts,
    displayedProducts,
    hasMore,
    loadMore,
    totalFiltered,
    brands,
    categories,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    selectedBrand,
    setSelectedBrand,
    selectedCategory,
    setSelectedCategory,
    clearFilters,
    hasActiveFilters,
    selectedProduct,
    isDetailOpen,
    openProductDetail,
    closeProductDetail,
    isContactOpen,
    openContact,
    closeContact,
    isFilterDrawerOpen,
    setIsFilterDrawerOpen,
  } = usePublicCatalog();

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans antialiased text-slate-900 flex flex-col">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-100 transition-all">
        <div className="container mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between max-w-7xl">
          <Link to="/" className="flex items-center gap-3 group cursor-pointer">
            <img
              src="/logo.svg"
              alt="Desembre Logo"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-contain shadow-sm group-hover:scale-105 transition-transform"
            />
            <span className="text-base sm:text-xl font-black tracking-tighter flex items-center">
              DESEMBRE <span className="text-indigo-600 ml-1">HUB</span>
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 ml-1.5 group-hover:rotate-12 transition-transform" />
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={openContact}
              className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl px-3.5 h-9 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-indigo-600" />
              <span>Hotline 0333.60.26.26</span>
            </Button>

            {user ? (
              <Button
                asChild
                size="sm"
                className="h-9 sm:h-10 px-4 sm:px-5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                <Link to="/workspace">
                  <span>Hub làm việc</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                size="sm"
                className="h-9 sm:h-10 px-4 sm:px-5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                <Link to="/login">
                  <LogIn className="w-3.5 h-3.5 mr-1.5 text-indigo-300" />
                  <span>Đăng nhập Partner</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 space-y-6 sm:space-y-8 pb-16">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl pt-4 sm:pt-6">
          {/* 1. Compact Hero Header */}
          <CatalogHero onOpenContact={openContact} totalProducts={products.length} />
        </div>

        {/* 2 & 3. Search, Filter, and Product Grid / Table */}
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl space-y-6">
          <CatalogFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            brands={brands}
            selectedBrand={selectedBrand}
            onSelectBrand={setSelectedBrand}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            totalResults={filteredProducts.length}
            isDrawerOpen={isFilterDrawerOpen}
            onToggleDrawer={setIsFilterDrawerOpen}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {viewMode === "grid" ? (
            <CatalogProductGrid
              products={displayedProducts}
              loading={loading}
              onSelectProduct={openProductDetail}
              onClearFilters={clearFilters}
            />
          ) : (
            <CatalogProductTable
              products={displayedProducts}
              loading={loading}
              onSelectProduct={openProductDetail}
              onOpenContact={openContact}
              onClearFilters={clearFilters}
            />
          )}

          {/* Large catalog UX: "Xem thêm" pagination */}
          {!loading && filteredProducts.length > 0 && (
            <CatalogLoadMore
              hasMore={hasMore}
              onLoadMore={loadMore}
              currentCount={displayedProducts.length}
              totalCount={totalFiltered}
            />
          )}
        </div>
      </main>

      {/* 4. Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={isDetailOpen}
        onClose={closeProductDetail}
        onOpenContact={openContact}
      />

      {/* Quick Contact Modal */}
      <ContactConsultationModal
        isOpen={isContactOpen}
        onClose={closeContact}
        productName={selectedProduct?.name}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-10 px-6 mt-auto">
        <div className="container mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <img
              src="/logo.svg"
              alt="Desembre Logo"
              className="w-7 h-7 rounded-lg object-contain"
            />
            <span className="text-sm font-black tracking-tight text-slate-800">
              DESEMBRE VIETNAM
            </span>
          </div>

          <p className="text-xs text-slate-400 font-medium">
            © {new Date().getFullYear()} Desembre Vietnam. All rights reserved.
          </p>

          <div className="flex items-center gap-4 text-xs font-bold text-slate-500 justify-center">
            <button
              onClick={openContact}
              className="hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Hotline: 0333.60.26.26
            </button>
            <span className="text-slate-300">•</span>
            <Link to="/login" className="hover:text-indigo-600 transition-colors">
              Cổng Partner
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
