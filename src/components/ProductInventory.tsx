import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type ToastType = "success" | "error";

interface Product {
  id: number;
  name: string;
  sku: string;
  brand?: string | null;
  price: string | number;
  imageUrl?: string | null;
}

interface ProductVariant {
  id: number;
  productId: number;
  sku: string;
  attributeName: string;
  attributeValue: string;
  price: string | number;
  stock: number;
}

interface ProductsResponse {
  data?: Product[];
  products?: Product[];
}

interface ProductVariantsResponse {
  data?: ProductVariant[];
  variants?: ProductVariant[];
}

interface VariantFormState {
  sku: string;
  attributeName: string;
  attributeValue: string;
  price: string;
  stock: string;
}

interface ToastState {
  type: ToastType;
  message: string;
}

const API_BASE_URL = "http://localhost:3000/api/v1";

const initialVariantForm: VariantFormState = {
  sku: "",
  attributeName: "",
  attributeValue: "",
  price: "",
  stock: "",
};

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("adminToken") ?? localStorage.getItem("token");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error("Yêu cầu không thành công");
  }

  return response.json() as Promise<T>;
}

function formatCurrency(value: string | number) {
  return currencyFormatter.format(Number(value));
}

function getProducts(response: ProductsResponse) {
  return response.data ?? response.products ?? [];
}

function getVariants(response: ProductVariantsResponse) {
  return response.data ?? response.variants ?? [];
}

function getVariantName(variant: ProductVariant) {
  return `${variant.attributeName} - ${variant.attributeValue}`;
}

function ProductInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({});
  const [variantForm, setVariantForm] = useState<VariantFormState>(initialVariantForm);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);
  const [updatingVariantId, setUpdatingVariantId] = useState<number | null>(null);
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const hasSelectedProduct = useMemo(() => selectedProduct !== null, [selectedProduct]);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchProducts = useCallback(async () => {
    setIsLoadingProducts(true);

    try {
      const response = await requestApi<ProductsResponse>("/admin/products?limit=50");
      setProducts(getProducts(response));
    } catch {
      showToast("error", "Không thể tải danh sách sản phẩm.");
    } finally {
      setIsLoadingProducts(false);
    }
  }, [showToast]);

  const fetchVariants = useCallback(async (productId: number) => {
    setIsLoadingVariants(true);

    try {
      const response = await requestApi<ProductVariantsResponse>(`/admin/products/${productId}/variants`);
      const nextVariants = getVariants(response);
      setVariants(nextVariants);
      setStockDrafts(
        Object.fromEntries(nextVariants.map((variant) => [variant.id, String(variant.stock)])),
      );
    } catch {
      setVariants([]);
      setStockDrafts({});
      showToast("error", "Không thể tải danh sách biến thể của sản phẩm.");
    } finally {
      setIsLoadingVariants(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const selectProduct = (product: Product) => {
    setSelectedProduct(product);
    setVariantForm(initialVariantForm);
    void fetchVariants(product.id);
  };

  const updateStockDraft = (variantId: number, value: string) => {
    setStockDrafts((currentDrafts) => ({
      ...currentDrafts,
      [variantId]: value,
    }));
  };

  const updateVariantStock = async (variantId: number) => {
    const stockValue = Number(stockDrafts[variantId]);

    if (!Number.isInteger(stockValue) || stockValue < 0) {
      showToast("error", "Số lượng tồn kho phải là số nguyên không âm.");
      return;
    }

    setUpdatingVariantId(variantId);

    try {
      await requestApi(`/admin/product-variants/${variantId}`, {
        method: "PUT",
        body: JSON.stringify({
          stock: stockValue,
        }),
      });
      showToast("success", "Đã cập nhật kho hàng.");

      if (selectedProduct) {
        await fetchVariants(selectedProduct.id);
      }
    } catch {
      showToast("error", "Không thể cập nhật kho hàng.");
    } finally {
      setUpdatingVariantId(null);
    }
  };

  const updateVariantForm = (field: keyof VariantFormState, value: string) => {
    setVariantForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const createVariant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedProduct) {
      showToast("error", "Vui lòng chọn sản phẩm trước khi thêm biến thể.");
      return;
    }

    setIsCreatingVariant(true);

    try {
      await requestApi(`/admin/products/${selectedProduct.id}/variants`, {
        method: "POST",
        body: JSON.stringify({
          sku: variantForm.sku.trim(),
          attributeName: variantForm.attributeName.trim(),
          attributeValue: variantForm.attributeValue.trim(),
          price: Number(variantForm.price),
          stock: Number(variantForm.stock || 0),
        }),
      });
      setVariantForm(initialVariantForm);
      showToast("success", "Đã thêm biến thể mới.");
      await fetchVariants(selectedProduct.id);
    } catch {
      showToast("error", "Không thể thêm biến thể mới.");
    } finally {
      setIsCreatingVariant(false);
    }
  };

  return (
    <section className="product-inventory">
      <style>{styles}</style>

      {toast && (
        <div className={`product-inventory-toast product-inventory-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      <div className="product-inventory-header">
        <div>
          <p>Quản trị kho hàng</p>
          <h2>Sản phẩm và biến thể</h2>
        </div>
        <button type="button" className="product-inventory-refresh" onClick={() => void fetchProducts()}>
          Tải lại sản phẩm
        </button>
      </div>

      <div className="product-inventory-layout">
        <section className="product-inventory-products">
          <div className="product-inventory-panel-title">
            <h3>Danh sách sản phẩm</h3>
            <p>Chọn một sản phẩm để quản lý biến thể và tồn kho.</p>
          </div>

          {isLoadingProducts ? (
            <div className="product-inventory-loading">
              <span className="product-inventory-spinner" />
              Đang tải danh sách sản phẩm...
            </div>
          ) : (
            <div className="product-inventory-product-list">
              {products.map((product) => {
                const isSelected = selectedProduct?.id === product.id;

                return (
                  <button
                    key={product.id}
                    type="button"
                    className={isSelected ? "product-inventory-product active" : "product-inventory-product"}
                    onClick={() => selectProduct(product)}
                  >
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} />
                    ) : (
                      <span className="product-inventory-image-placeholder">SP</span>
                    )}
                    <span>
                      <strong>{product.name}</strong>
                      <small>
                        SKU: {product.sku} · {formatCurrency(product.price)}
                      </small>
                    </span>
                  </button>
                );
              })}

              {products.length === 0 && (
                <p className="product-inventory-empty">Chưa có sản phẩm nào.</p>
              )}
            </div>
          )}
        </section>

        <section className="product-inventory-detail">
          {!hasSelectedProduct && (
            <div className="product-inventory-placeholder">
              <h3>Chưa chọn sản phẩm</h3>
              <p>Vui lòng chọn một sản phẩm ở danh sách bên trái để xem và chỉnh sửa biến thể.</p>
            </div>
          )}

          {selectedProduct && (
            <>
              <div className="product-inventory-detail-header">
                <div>
                  <p>Đang quản lý</p>
                  <h3>{selectedProduct.name}</h3>
                  <span>SKU gốc: {selectedProduct.sku}</span>
                </div>
                <button type="button" onClick={() => setSelectedProduct(null)}>
                  Đóng chi tiết
                </button>
              </div>

              {isLoadingVariants ? (
                <div className="product-inventory-loading">
                  <span className="product-inventory-spinner" />
                  Đang tải biến thể sản phẩm...
                </div>
              ) : (
                <div className="product-inventory-table-wrap">
                  <table className="product-inventory-table">
                    <thead>
                      <tr>
                        <th>Tên biến thể</th>
                        <th>SKU</th>
                        <th>Giá bán</th>
                        <th>Số lượng tồn kho</th>
                        <th>Cập nhật</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((variant) => {
                        const isUpdating = updatingVariantId === variant.id;

                        return (
                          <tr key={variant.id}>
                            <td>
                              <strong>{getVariantName(variant)}</strong>
                            </td>
                            <td>{variant.sku}</td>
                            <td className="product-inventory-money">{formatCurrency(variant.price)}</td>
                            <td>
                              <input
                                min="0"
                                type="number"
                                value={stockDrafts[variant.id] ?? String(variant.stock)}
                                onChange={(event) => updateStockDraft(variant.id, event.target.value)}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="product-inventory-update-stock"
                                disabled={isUpdating}
                                onClick={() => void updateVariantStock(variant.id)}
                              >
                                {isUpdating && <span className="product-inventory-spinner small" />}
                                Cập nhật kho hàng
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {variants.length === 0 && (
                    <p className="product-inventory-empty">Sản phẩm này chưa có biến thể nào.</p>
                  )}
                </div>
              )}

              <form className="product-inventory-variant-form" onSubmit={(event) => void createVariant(event)}>
                <div className="product-inventory-panel-title">
                  <h3>Thêm biến thể mới</h3>
                  <p>Nhập thông tin biến thể cho sản phẩm đang chọn.</p>
                </div>

                <div className="product-inventory-form-grid">
                  <label>
                    SKU biến thể
                    <input
                      required
                      value={variantForm.sku}
                      onChange={(event) => updateVariantForm("sku", event.target.value)}
                      placeholder="Ví dụ: IP15-TTN-256"
                    />
                  </label>

                  <label>
                    Tên thuộc tính
                    <input
                      required
                      value={variantForm.attributeName}
                      onChange={(event) => updateVariantForm("attributeName", event.target.value)}
                      placeholder="Ví dụ: Màu sắc"
                    />
                  </label>

                  <label>
                    Giá trị thuộc tính
                    <input
                      required
                      value={variantForm.attributeValue}
                      onChange={(event) => updateVariantForm("attributeValue", event.target.value)}
                      placeholder="Ví dụ: Titan Tự Nhiên"
                    />
                  </label>

                  <label>
                    Giá bán
                    <input
                      required
                      min="0"
                      type="number"
                      value={variantForm.price}
                      onChange={(event) => updateVariantForm("price", event.target.value)}
                      placeholder="Ví dụ: 29990000"
                    />
                  </label>

                  <label>
                    Tồn kho
                    <input
                      required
                      min="0"
                      type="number"
                      value={variantForm.stock}
                      onChange={(event) => updateVariantForm("stock", event.target.value)}
                      placeholder="Ví dụ: 15"
                    />
                  </label>
                </div>

                <button type="submit" disabled={isCreatingVariant}>
                  {isCreatingVariant && <span className="product-inventory-spinner small" />}
                  Thêm biến thể mới
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

const styles = `
  .product-inventory {
    display: grid;
    gap: 18px;
    color: #0f172a;
    text-align: left;
  }

  .product-inventory-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
  }

  .product-inventory-header p,
  .product-inventory-panel-title p,
  .product-inventory-detail-header p {
    margin: 0;
    color: #64748b;
    font-size: 13px;
  }

  .product-inventory-header p {
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .product-inventory-header h2,
  .product-inventory-panel-title h3,
  .product-inventory-detail-header h3,
  .product-inventory-placeholder h3 {
    margin: 6px 0 0;
    color: #0f172a;
    letter-spacing: 0;
    line-height: 1.2;
  }

  .product-inventory-header h2 {
    font-size: 24px;
  }

  .product-inventory-panel-title h3,
  .product-inventory-detail-header h3,
  .product-inventory-placeholder h3 {
    font-size: 18px;
  }

  .product-inventory-refresh,
  .product-inventory-detail-header button,
  .product-inventory-update-stock,
  .product-inventory-variant-form button {
    font: inherit;
    font-weight: 900;
  }

  .product-inventory-refresh,
  .product-inventory-detail-header button {
    height: 40px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    cursor: pointer;
    padding: 0 14px;
  }

  .product-inventory-layout {
    display: grid;
    grid-template-columns: 360px minmax(0, 1fr);
    gap: 18px;
  }

  .product-inventory-products,
  .product-inventory-detail,
  .product-inventory-variant-form {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
  }

  .product-inventory-products,
  .product-inventory-detail {
    padding: 18px;
  }

  .product-inventory-product-list {
    display: grid;
    gap: 10px;
    margin-top: 16px;
    max-height: 720px;
    overflow: auto;
    padding-right: 4px;
  }

  .product-inventory-product {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    width: 100%;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    cursor: pointer;
    padding: 10px;
    text-align: left;
  }

  .product-inventory-product.active {
    border-color: #0f172a;
    background: #f8fafc;
    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
  }

  .product-inventory-product img,
  .product-inventory-image-placeholder {
    width: 52px;
    height: 52px;
    border-radius: 8px;
  }

  .product-inventory-product img {
    border: 1px solid #e2e8f0;
    object-fit: cover;
  }

  .product-inventory-image-placeholder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    color: #64748b;
    font-weight: 900;
  }

  .product-inventory-product strong,
  .product-inventory-product small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .product-inventory-product strong {
    font-size: 14px;
  }

  .product-inventory-product small {
    margin-top: 4px;
    color: #64748b;
    font-size: 12px;
  }

  .product-inventory-placeholder {
    display: grid;
    min-height: 360px;
    place-content: center;
    text-align: center;
  }

  .product-inventory-placeholder p {
    max-width: 420px;
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
  }

  .product-inventory-detail {
    display: grid;
    gap: 18px;
  }

  .product-inventory-detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 16px;
  }

  .product-inventory-detail-header span {
    display: block;
    margin-top: 6px;
    color: #64748b;
    font-size: 13px;
  }

  .product-inventory-table-wrap {
    overflow-x: auto;
  }

  .product-inventory-table {
    width: 100%;
    min-width: 760px;
    border-collapse: collapse;
    font-size: 14px;
  }

  .product-inventory-table th {
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.04em;
    padding: 13px 14px;
    text-align: left;
    text-transform: uppercase;
  }

  .product-inventory-table td {
    border-top: 1px solid #e2e8f0;
    color: #334155;
    padding: 14px;
    vertical-align: middle;
  }

  .product-inventory-table td strong,
  .product-inventory-money {
    color: #0f172a;
    font-weight: 900;
  }

  .product-inventory-table input,
  .product-inventory-variant-form input {
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    font: inherit;
    font-size: 14px;
    outline: none;
    padding: 10px 12px;
  }

  .product-inventory-table input {
    max-width: 120px;
  }

  .product-inventory-table input:focus,
  .product-inventory-variant-form input:focus {
    border-color: #0f172a;
    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
  }

  .product-inventory-update-stock,
  .product-inventory-variant-form button {
    display: inline-flex;
    min-height: 40px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 8px;
    background: #0f172a;
    color: #ffffff;
    cursor: pointer;
    padding: 0 14px;
    white-space: nowrap;
  }

  .product-inventory-update-stock:disabled,
  .product-inventory-variant-form button:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .product-inventory-variant-form {
    display: grid;
    gap: 16px;
    padding: 18px;
  }

  .product-inventory-form-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }

  .product-inventory-variant-form label {
    display: grid;
    gap: 7px;
    color: #334155;
    font-size: 13px;
    font-weight: 800;
  }

  .product-inventory-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #64748b;
    font-size: 14px;
    padding: 22px 0;
  }

  .product-inventory-empty {
    margin: 0;
    color: #64748b;
    font-size: 14px;
    padding: 18px 0;
  }

  .product-inventory-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #cbd5e1;
    border-top-color: #0f172a;
    border-radius: 999px;
    animation: product-inventory-spin 800ms linear infinite;
  }

  .product-inventory-spinner.small {
    width: 14px;
    height: 14px;
    border-color: rgba(255, 255, 255, 0.45);
    border-top-color: #ffffff;
  }

  .product-inventory-toast {
    position: fixed;
    top: 18px;
    right: 18px;
    z-index: 30;
    border-radius: 8px;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
    color: #ffffff;
    font-size: 14px;
    font-weight: 900;
    padding: 12px 14px;
  }

  .product-inventory-toast-success {
    background: #059669;
  }

  .product-inventory-toast-error {
    background: #dc2626;
  }

  @keyframes product-inventory-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1100px) {
    .product-inventory-layout {
      grid-template-columns: 1fr;
    }

    .product-inventory-form-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .product-inventory-header,
    .product-inventory-detail-header {
      align-items: stretch;
      flex-direction: column;
    }

    .product-inventory-refresh,
    .product-inventory-detail-header button,
    .product-inventory-variant-form button {
      width: 100%;
    }

    .product-inventory-form-grid {
      grid-template-columns: 1fr;
    }
  }
`;

export default ProductInventory;
