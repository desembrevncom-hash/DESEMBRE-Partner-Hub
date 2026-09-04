import { createFileRoute } from "@tanstack/react-router";
import { Search, Plus, Download, Zap, Loader2, LayoutGrid, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { FullCatalogPDF } from "@/components/FullCatalogPDF";
import { EditUnlockProvider } from "@/hooks/useEditUnlock";
import { ProductKnowledgeDialog } from "@/components/ProductKnowledgeDialog";
import { ProductSalesSheetDialog } from "@/components/admin/templates/ProductSalesSheetDialog";
import { CRMPageContainer } from "@/components/crm/CRMPageContainer";
import { CRMPageHeader } from "@/components/crm/CRMPageHeader";
import { CRMCard } from "@/components/crm/CRMCard";
import { CRMTableWrapper } from "@/components/crm/CRMTableWrapper";
import { CRMEmptyState } from "@/components/crm/CRMEmptyState";
import { BrandCategoryManagement } from "@/components/admin/BrandCategoryManagement";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Feature sub-components
import { useProductCatalog } from "@/features/products/useProductCatalog";
import { CategoryDisplay } from "@/features/products/CategoryDisplay";
import { ProductRow } from "@/features/products/ProductRow";
import { ProductMobileCard } from "@/features/products/ProductMobileCard";
import { CartDrawer } from "@/features/products/CartDrawer";
import { ProductPagination } from "@/features/products/ProductPagination";
import { ProductCatalogDebugConsole } from "@/features/products/ProductCatalogDebugConsole";

export const Route = createFileRoute("/admin/products")({
  component: ProductCatalogPage,
});

function ProductCatalogPage() {
  const {
    user,
    isAdmin,
    roles,
    isManager,
    vatRate,
    isDbAdminEnabled,
    isCatalogDbReadEnabled,
    isProductDbOrderEnabled,
    isUsingDbCatalogData,
    loading,
    dbError,
    dbErrorMessage,
    activeTab,
    setActiveTab,
    productsToFilter,
    filteredProducts,
    paginatedProducts,
    dbBrands,
    activeCategoriesToDisplay,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    selectedBrandFilter,
    isCategoryExpanded,
    setIsCategoryExpanded,
    handleBrandChange,
    vatOn,
    setVatOn,
    saleViewMode,
    fmt,
    cart,
    cartDrawerOpen,
    setCartDrawerOpen,
    removeCartItem,
    clearCart,
    handleCreateOrder,
    selectedKnowledgeProductId,
    setSelectedKnowledgeProductId,
    salesSheetsMap,
    salesSheetDialogOpen,
    setSalesSheetDialogOpen,
    selectedSalesSheetProduct,
    setSelectedSalesSheetProduct,
    loadSalesSheets,
    handleUpdate,
    handlePick,
    getProductGuard,
    currentPage,
    totalPages,
    goToPrev,
    goToNext,
    goToPage,
    PAGE_SIZE,
  } = useProductCatalog();

  return (
    <EditUnlockProvider>
      <CRMPageContainer>
        <CRMPageHeader
          title="Danh Mục Sản Phẩm (Product Catalog)"
          subtitle="Master Catalog v4.0"
          badgeText={isUsingDbCatalogData ? "Catalog DB Preview" : "ADMIN ONLY"}
          icon={LayoutGrid}
          actions={
            <>
              <PDFDownloadLink
                document={
                  <FullCatalogPDF
                    products={productsToFilter}
                    vatOn={vatOn}
                    vatRate={vatRate}
                    role={isAdmin && saleViewMode ? "sale" : undefined}
                  />
                }
                fileName="DESEMBRE_Master_Catalog.pdf"
              >
                {({ loading: pdfLoading }) => (
                  <Button
                    variant="outline"
                    className="h-10 px-5 rounded-xl border-slate-200 hover:bg-slate-50 text-xs font-bold transition-all shadow-3xs"
                    disabled={pdfLoading}
                  >
                    <Download className="w-4 h-4 mr-2 text-slate-500" />
                    {pdfLoading ? "Đang chuẩn bị PDF..." : "Tải Catalog PDF"}
                  </Button>
                )}
              </PDFDownloadLink>

              {/* Task 12: THÊM SẢN PHẨM — disabled with tooltip until create flow exists */}
              {isManager && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          disabled
                          className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm shadow-indigo-200 transition-all shrink-0 cursor-not-allowed opacity-60"
                        >
                          <Plus className="w-4 h-4 mr-2 shrink-0" /> THÊM SẢN PHẨM
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">
                        Tính năng đang phát triển — sử dụng tab Quản lý Brand &amp; Danh mục để thêm
                        sản phẩm qua DB.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          }
        />

        <main className="container mx-auto px-6 py-8 max-w-7xl space-y-8 animate-fade-in">
          {/* Feature flag warning */}
          {!isCatalogDbReadEnabled && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-xs font-semibold flex flex-col gap-1.5 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-bold text-amber-950">
                  Feature Flags Missing (Catalog DB is Disabled)
                </span>
              </div>
              <p className="text-slate-600 pl-6 leading-relaxed">
                Biến môi trường{" "}
                <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-amber-800">
                  VITE_PRODUCT_CATALOG_DB_READ_ENABLED
                </code>{" "}
                chưa được cấu hình hoặc bằng <code className="font-mono">false</code> ở thời điểm
                build trên Vercel. Hệ thống bắt buộc chạy ở chế độ{" "}
                <strong>Legacy Fallback (Danh mục tĩnh cũ)</strong>. Hãy thêm biến môi trường và
                chạy redeploy lại Vercel.
              </p>
            </div>
          )}

          {/* DB error banner */}
          {isCatalogDbReadEnabled && dbError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-semibold flex flex-col gap-1.5 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-bold text-rose-900">Database Connection Failed</span>
              </div>
              <p className="text-slate-600 pl-6 leading-relaxed">
                Không thể kết nối hoặc truy vấn dữ liệu từ Supabase Staging. Hệ thống tự động chuyển
                sang chế độ dự phòng tĩnh (Legacy Fallback).
              </p>
              <div className="bg-rose-100/50 p-2 rounded font-mono text-[10px] text-rose-900 pl-6 border border-rose-200/50 mt-1 whitespace-pre-wrap">
                Chi tiết lỗi: {dbErrorMessage || "Không có thông báo lỗi cụ thể"}
              </div>
            </div>
          )}

          {/* Tab switcher */}
          {isDbAdminEnabled && isManager && (
            <div className="flex border-b border-slate-200 pb-1">
              <div className="bg-slate-100/80 p-1 rounded-xl flex gap-1">
                <button
                  onClick={() => setActiveTab("catalog")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                    ${activeTab === "catalog" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  Danh mục sản phẩm
                </button>
                <button
                  onClick={() => setActiveTab("mgmt")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                    ${activeTab === "mgmt" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  Quản lý Brand &amp; Danh mục
                </button>
              </div>
            </div>
          )}

          {activeTab === "mgmt" && isDbAdminEnabled && isManager ? (
            <BrandCategoryManagement />
          ) : (
            <>
              {isManager && !isDbAdminEnabled && (
                <div className="bg-blue-50/50 text-blue-600 px-4 py-2 rounded-xl text-xs font-medium border border-blue-100 flex items-center gap-2">
                  Danh mục hiện được quản lý cố định trong mã nguồn. Muốn thêm/sửa nhóm cần triển
                  khai phase Category Management riêng.
                </div>
              )}

              {/* FILTERS & SEARCH */}
              <div className="flex flex-col lg:flex-row gap-3 items-center bg-white p-3 lg:p-2 rounded-2xl border border-slate-200 shadow-sm sticky top-16 lg:static z-30">
                <div className="relative group w-full lg:w-1/3 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <Input
                    placeholder="Tìm tên, công dụng..."
                    className="pl-9 h-11 lg:h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-medium placeholder:text-slate-400 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {isUsingDbCatalogData && (
                  <div className="w-full lg:w-48 shrink-0">
                    <Select value={selectedBrandFilter} onValueChange={handleBrandChange}>
                      <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                        <SelectValue placeholder="Thương hiệu" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200">
                        <SelectItem value="all" className="text-xs font-bold uppercase">
                          Tất cả thương hiệu
                        </SelectItem>
                        {dbBrands.map((b) => (
                          <SelectItem
                            key={b.id}
                            value={b.id}
                            className="text-xs font-bold uppercase"
                          >
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex-1" />

                <div className="flex items-center justify-between lg:justify-end px-1 lg:px-2 shrink-0 w-full lg:w-auto border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0">
                  <div className="text-[10px] font-bold text-slate-400 lg:hidden">
                    {filteredProducts.length} KẾT QUẢ
                  </div>
                  <div
                    className="flex items-center gap-2 bg-slate-50 px-3 py-2 lg:py-1.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => setVatOn(!vatOn)}
                  >
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Hiển thị giá:
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold uppercase transition-colors ${!vatOn ? "text-indigo-600" : "text-slate-400"}`}
                      >
                        Chưa VAT
                      </span>
                      <div className="relative w-7 h-4 bg-slate-200 rounded-full transition-colors duration-200">
                        <div
                          className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${vatOn ? "translate-x-3 bg-indigo-600" : ""}`}
                        />
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase transition-colors ${vatOn ? "text-indigo-600" : "text-slate-400"}`}
                      >
                        Có VAT
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CATEGORY DISPLAY */}
              <CategoryDisplay
                isUsingDbCatalogData={isUsingDbCatalogData}
                selectedBrandFilter={selectedBrandFilter}
                dbBrands={dbBrands}
                activeCategoriesToDisplay={activeCategoriesToDisplay}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                isCategoryExpanded={isCategoryExpanded}
                setIsCategoryExpanded={setIsCategoryExpanded}
              />

              {/* PRODUCT TABLE */}
              <CRMCard className="p-0 overflow-hidden border-slate-200 bg-white">
                {/* Desktop view */}
                <div className="hidden lg:block">
                  <CRMTableWrapper>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          <th className="px-3 py-4 text-center w-14">STT</th>
                          <th className="px-3 py-4 text-center w-24">Hình ảnh</th>
                          <th className="px-6 py-4 text-left">Sản phẩm</th>
                          <th className="px-3 py-4 text-center w-36">Size</th>
                          <th className="px-6 py-4 text-right w-44">Retail</th>
                          <th className="px-6 py-4 text-right w-44">Salon</th>
                          <th className="px-3 py-4 text-center w-40">Tài liệu</th>
                          <th className="px-3 py-4 text-center w-40">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loading ? (
                          <tr>
                            <td colSpan={8} className="py-32 text-center">
                              <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">
                                  Đang đồng bộ dữ liệu Cloud...
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : paginatedProducts.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-32 text-center">
                              <div className="flex flex-col items-center gap-4 opacity-30">
                                <Zap className="w-16 h-16 text-slate-600" />
                                <p className="text-sm font-bold text-slate-500">
                                  Không tìm thấy sản phẩm nào phù hợp
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          paginatedProducts.map((p, idx) => {
                            const globalIdx = (currentPage - 1) * PAGE_SIZE + idx;
                            const guard = getProductGuard(p);
                            const salesSheetInfo =
                              p.isDbProduct && p.dbId ? salesSheetsMap[p.dbId] : undefined;
                            return (
                              <ProductRow
                                key={p.dbId || p.id}
                                product={p}
                                idx={globalIdx}
                                isManager={isManager}
                                isUsingDbCatalogData={isUsingDbCatalogData}
                                vatOn={vatOn}
                                fmt={fmt}
                                guard={guard}
                                salesSheetInfo={salesSheetInfo}
                                onPick={(sizeType) => handlePick(p, sizeType)}
                                onUpdate={(field, value) => handleUpdate(p.id, field, value)}
                                onOpenKnowledge={() => setSelectedKnowledgeProductId(p.id)}
                                onOpenSalesSheet={() => {
                                  setSelectedSalesSheetProduct(p);
                                  setSalesSheetDialogOpen(true);
                                }}
                              />
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </CRMTableWrapper>
                </div>

                {/* Mobile card view */}
                <div className="block lg:hidden space-y-4 p-4">
                  {loading ? (
                    <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">
                          Đang đồng bộ dữ liệu Cloud...
                        </p>
                      </div>
                    </div>
                  ) : paginatedProducts.length === 0 ? (
                    <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
                      <CRMEmptyState title="Không tìm thấy sản phẩm nào phù hợp" />
                    </div>
                  ) : (
                    paginatedProducts.map((p) => {
                      const guard = getProductGuard(p);
                      const salesSheetInfo =
                        p.isDbProduct && p.dbId ? salesSheetsMap[p.dbId] : undefined;
                      return (
                        <ProductMobileCard
                          key={p.dbId || p.id}
                          product={p}
                          isManager={isManager}
                          isUsingDbCatalogData={isUsingDbCatalogData}
                          vatOn={vatOn}
                          fmt={fmt}
                          guard={guard}
                          salesSheetInfo={salesSheetInfo}
                          onPick={(sizeType) => handlePick(p, sizeType)}
                          onUpdate={(field, value) => handleUpdate(p.id, field, value)}
                          onOpenKnowledge={() => setSelectedKnowledgeProductId(p.id)}
                          onOpenSalesSheet={() => {
                            setSelectedSalesSheetProduct(p);
                            setSalesSheetDialogOpen(true);
                          }}
                        />
                      );
                    })
                  )}
                </div>

                {/* Real pagination footer */}
                <ProductPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredProducts.length}
                  pageSize={PAGE_SIZE}
                  onPrev={goToPrev}
                  onNext={goToNext}
                  onPageChange={goToPage}
                />
              </CRMCard>
            </>
          )}
        </main>

        {/* Cart drawer (Task 9) */}
        <CartDrawer
          cart={cart}
          isOpen={cartDrawerOpen}
          onOpen={() => setCartDrawerOpen(true)}
          onClose={() => setCartDrawerOpen(false)}
          onRemove={removeCartItem}
          onClear={clearCart}
          onCreateOrder={handleCreateOrder}
        />

        {/* Knowledge dialog */}
        <ProductKnowledgeDialog
          productId={selectedKnowledgeProductId}
          productName={
            productsToFilter.find((p) => p.id === selectedKnowledgeProductId)?.name || ""
          }
          productsList={productsToFilter.map((p) => ({ id: p.id, name: p.name }))}
          onClose={() => setSelectedKnowledgeProductId(null)}
          onSaved={() => {}}
        />

        {/* Sales sheet dialog */}
        {selectedSalesSheetProduct && (
          <ProductSalesSheetDialog
            isOpen={salesSheetDialogOpen}
            onClose={() => {
              setSalesSheetDialogOpen(false);
              setSelectedSalesSheetProduct(null);
            }}
            catalogProductId={selectedSalesSheetProduct.dbId || ""}
            productName={selectedSalesSheetProduct.name}
            brandId={selectedSalesSheetProduct.brand_id || ""}
            categoryName={selectedSalesSheetProduct.categoryName || undefined}
            imageUrl={selectedSalesSheetProduct.imageUrl}
            productCode={selectedSalesSheetProduct.product_code || undefined}
            onSaved={loadSalesSheets}
          />
        )}

        {/* Task 11: Debug console — DEV + manager only */}
        {import.meta.env.DEV && isManager && (
          <ProductCatalogDebugConsole
            isCatalogDbReadEnabled={isCatalogDbReadEnabled}
            isDbAdminEnabled={isDbAdminEnabled}
            isProductDbOrderEnabled={isProductDbOrderEnabled}
            isUsingDbCatalogData={isUsingDbCatalogData}
            userEmail={user?.email}
            roles={roles}
            isAdmin={isAdmin}
            isManager={isManager}
            dbError={dbError}
            dbErrorMessage={dbErrorMessage}
          />
        )}
      </CRMPageContainer>
    </EditUnlockProvider>
  );
}
