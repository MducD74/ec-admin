import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Pagination from "./Common/Pagination";

type ToastType = "success" | "error";

interface Category {
  id: number;
  name: string;
  children?: Category[];
}

interface Product {
  id: number;
  name: string;
  brandId?: number | null;
  brand?: {
    id: number;
    name: string;
    logoUrl?: string | null;
  } | null;
  price: string | number;
  imageUrl?: string | null;
  categoryId?: number | null;
  category?: {
    id: number;
    name: string;
  } | null;
  inventory?: Array<{
    id: number;
    status: string;
  }>;
}

interface ProductsResponse {
  data?: Product[];
  products?: Product[];
  meta?: PaginationMeta;
  pagination?: {
    totalPages?: number;
    page?: number;
    limit?: number;
    total?: number;
  };
}

interface PaginationMeta {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

interface CategoriesResponse {
  data?: Category[];
  categories?: Category[];
}

interface Brand {
  id: number;
  name: string;
  logoUrl?: string | null;
}

interface BrandsResponse {
  data?: Brand[];
  brands?: Brand[];
}

interface ProductFormState {
  name: string;
  price: string;
  brandId: string;
  categoryId: string;
  initialStock: string;
}

interface ToastState {
  type: ToastType;
  message: string;
}

const API_BASE_URL = "http://localhost:3000/api/v1";

const initialFormState: ProductFormState = {
  name: "",
  price: "",
  brandId: "",
  categoryId: "",
  initialStock: "",
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

function getBrands(response: BrandsResponse) {
  return response.data ?? response.brands ?? [];
}

function flattenCategories(categories: Category[]): Category[] {
  return categories.flatMap((category) => [
    category,
    ...flattenCategories(category.children ?? []),
  ]);
}

function getAvailableStock(product: Product) {
  return product.inventory?.filter((item) => item.status === "AVAILABLE").length ?? 0;
}

function CatalogManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [formState, setFormState] = useState<ProductFormState>(initialFormState);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchProducts = useCallback(async () => {
    setIsLoadingProducts(true);

    try {
      const response = await requestApi<ProductsResponse>(`/products?page=${page}&limit=10`);
      setProducts(getProducts(response));
      setMeta(
        response.meta ??
          (response.pagination
            ? {
                totalItems: response.pagination.total ?? 0,
                totalPages: response.pagination.totalPages ?? 1,
                currentPage: response.pagination.page ?? page,
                limit: response.pagination.limit ?? 10,
              }
            : null)
      );
    } catch {
      showToast("error", "Không thể tải danh sách sản phẩm.");
    } finally {
      setIsLoadingProducts(false);
    }
  }, [page, showToast]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await requestApi<CategoriesResponse>("/categories");
      setCategories(response.data ?? response.categories ?? []);
    } catch {
      showToast("error", "Không thể tải danh mục sản phẩm.");
    }
  }, [showToast]);

  const fetchBrands = useCallback(async () => {
    try {
      const response = await requestApi<BrandsResponse>("/brands");
      setBrands(getBrands(response));
    } catch {
      showToast("error", "Không thể tải danh sách thương hiệu.");
    }
  }, [showToast]);

  useEffect(() => {
    void fetchProducts();
    void fetchCategories();
    void fetchBrands();
  }, [fetchProducts, fetchCategories, fetchBrands]);

  const updateFormField = (field: keyof ProductFormState, value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  };

  const createProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);

    try {
      await requestApi("/admin/products", {
        method: "POST",
        body: JSON.stringify({
          name: formState.name.trim(),
          price: Number(formState.price),
          brandId: formState.brandId ? Number(formState.brandId) : null,
          categoryId: formState.categoryId ? Number(formState.categoryId) : null,
          initialStock: Number(formState.initialStock || 0),
        }),
      });
      setFormState(initialFormState);
      showToast("success", "Đã thêm sản phẩm mới.");
      await fetchProducts();
    } catch {
      showToast("error", "Không thể thêm sản phẩm mới.");
    } finally {
      setIsCreating(false);
    }
  };

  const deleteProduct = async (productId: number) => {
    const confirmed = window.confirm("Bạn có chắc chắn muốn xóa sản phẩm này?");

    if (!confirmed) {
      return;
    }

    setDeletingProductId(productId);

    try {
      await requestApi(`/admin/products/${productId}`, {
        method: "DELETE",
      });
      showToast("success", "Đã xóa sản phẩm.");
      await fetchProducts();
    } catch {
      showToast("error", "Không thể xóa sản phẩm.");
    } finally {
      setDeletingProductId(null);
    }
  };

  return (
    <section className="catalog-management">
      <style>{styles}</style>

      {toast && (
        <div className={`catalog-management-toast catalog-management-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      <div className="catalog-management-header">
        <div>
          <p>Quản trị danh mục</p>
          <h2>Quản lý sản phẩm</h2>
        </div>
        <button type="button" className="catalog-management-refresh" onClick={() => void fetchProducts()}>
          Tải lại sản phẩm
        </button>
      </div>

      <form className="catalog-management-form" onSubmit={(event) => void createProduct(event)}>
        <div className="catalog-management-form-title">
          <h3>Thêm sản phẩm mới</h3>
          <p>Nhập thông tin cơ bản và số lượng kho ban đầu cho sản phẩm.</p>
        </div>

        <div className="catalog-management-form-grid">
          <label>
            Tên sản phẩm
            <input
              required
              value={formState.name}
              onChange={(event) => updateFormField("name", event.target.value)}
              placeholder="Ví dụ: iPhone 15 Pro Max"
            />
          </label>

          <label>
            Giá bán
            <input
              required
              min="0"
              type="number"
              value={formState.price}
              onChange={(event) => updateFormField("price", event.target.value)}
              placeholder="Ví dụ: 29990000"
            />
          </label>

          <label>
            Thương hiệu
            <select
              value={formState.brandId}
              onChange={(event) => updateFormField("brandId", event.target.value)}
            >
              <option value="">Chưa chọn thương hiệu</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Danh mục
            <select
              value={formState.categoryId}
              onChange={(event) => updateFormField("categoryId", event.target.value)}
            >
              <option value="">Chưa chọn danh mục</option>
              {flatCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Số lượng kho ban đầu
            <input
              required
              min="0"
              type="number"
              value={formState.initialStock}
              onChange={(event) => updateFormField("initialStock", event.target.value)}
              placeholder="Ví dụ: 20"
            />
          </label>
        </div>

        <div className="catalog-management-form-actions">
          <button type="submit" disabled={isCreating}>
            {isCreating && <span className="catalog-management-spinner small" />}
            Thêm sản phẩm mới
          </button>
        </div>
      </form>

      <section className="catalog-management-panel">
        {isLoadingProducts ? (
          <div className="catalog-management-loading">
            <span className="catalog-management-spinner" />
            Đang tải danh sách sản phẩm...
          </div>
        ) : (
          <div className="catalog-management-table-wrap">
            <table className="catalog-management-table">
              <thead>
                <tr>
                  <th>Ảnh</th>
                  <th>Tên sản phẩm</th>
                  <th>Danh mục</th>
                  <th>Thương hiệu</th>
                  <th>Giá bán</th>
                  <th>Tồn kho</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const isDeleting = deletingProductId === product.id;

                  return (
                    <tr key={product.id}>
                      <td>
                        {product.imageUrl ? (
                          <img
                            className="catalog-management-image"
                            src={product.imageUrl}
                            alt={product.name}
                          />
                        ) : (
                          <span className="catalog-management-image-placeholder">SP</span>
                        )}
                      </td>
                      <td>
                        <strong>{product.name}</strong>
                      </td>
                      <td>{product.category?.name ?? "Chưa phân loại"}</td>
                      <td>{product.brand?.name ?? "Chưa có"}</td>
                      <td className="catalog-management-money">{formatCurrency(product.price)}</td>
                      <td>{getAvailableStock(product)}</td>
                      <td>
                        <button
                          type="button"
                          className="catalog-management-delete"
                          disabled={isDeleting}
                          onClick={() => void deleteProduct(product.id)}
                        >
                          {isDeleting && <span className="catalog-management-spinner small" />}
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {products.length === 0 && (
              <p className="catalog-management-empty">Chưa có sản phẩm nào.</p>
            )}
          </div>
        )}
        {!isLoadingProducts && (
          <Pagination
            currentPage={page}
            totalPages={meta?.totalPages || 1}
            onPageChange={(nextPage) => setPage(nextPage)}
          />
        )}
      </section>
    </section>
  );
}

const styles = `
  .catalog-management {
    display: grid;
    gap: 18px;
    color: #0f172a;
    text-align: left;
  }

  .catalog-management-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
  }

  .catalog-management-header p,
  .catalog-management-form-title p {
    margin: 0;
    color: #64748b;
    font-size: 13px;
  }

  .catalog-management-header p {
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .catalog-management-header h2,
  .catalog-management-form-title h3 {
    margin: 6px 0 0;
    color: #0f172a;
    letter-spacing: 0;
    line-height: 1.2;
  }

  .catalog-management-header h2 {
    font-size: 24px;
  }

  .catalog-management-form-title h3 {
    font-size: 18px;
  }

  .catalog-management-refresh,
  .catalog-management-form-actions button,
  .catalog-management-delete {
    font: inherit;
    font-weight: 900;
  }

  .catalog-management-refresh {
    height: 40px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    cursor: pointer;
    padding: 0 14px;
  }

  .catalog-management-form,
  .catalog-management-panel {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
  }

  .catalog-management-form {
    display: grid;
    gap: 16px;
    padding: 20px;
  }

  .catalog-management-form-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
  }

  .catalog-management-form label {
    display: grid;
    gap: 7px;
    color: #334155;
    font-size: 13px;
    font-weight: 800;
  }

  .catalog-management-form input,
  .catalog-management-form select {
    width: 100%;
    height: 42px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    font: inherit;
    font-size: 14px;
    outline: none;
    padding: 0 12px;
  }

  .catalog-management-form input:focus,
  .catalog-management-form select:focus {
    border-color: #0f172a;
    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
  }

  .catalog-management-form-actions {
    display: flex;
    justify-content: flex-end;
  }

  .catalog-management-form-actions button,
  .catalog-management-delete {
    display: inline-flex;
    min-height: 40px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 8px;
    color: #ffffff;
    cursor: pointer;
    padding: 0 14px;
  }

  .catalog-management-form-actions button {
    background: #0f172a;
  }

  .catalog-management-delete {
    background: #dc2626;
  }

  .catalog-management-form-actions button:disabled,
  .catalog-management-delete:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .catalog-management-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #64748b;
    font-size: 14px;
    padding: 28px;
  }

  .catalog-management-table-wrap {
    overflow-x: auto;
  }

  .catalog-management-table {
    width: 100%;
    min-width: 920px;
    border-collapse: collapse;
    font-size: 14px;
  }

  .catalog-management-table th {
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.04em;
    padding: 13px 14px;
    text-align: left;
    text-transform: uppercase;
  }

  .catalog-management-table td {
    border-top: 1px solid #e2e8f0;
    color: #334155;
    padding: 14px;
    vertical-align: middle;
  }

  .catalog-management-table td strong,
  .catalog-management-money {
    color: #0f172a;
    font-weight: 900;
  }

  .catalog-management-image,
  .catalog-management-image-placeholder {
    width: 56px;
    height: 56px;
    border-radius: 8px;
  }

  .catalog-management-image {
    border: 1px solid #e2e8f0;
    object-fit: cover;
  }

  .catalog-management-image-placeholder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    color: #64748b;
    font-weight: 900;
  }

  .catalog-management-empty {
    margin: 0;
    color: #64748b;
    font-size: 14px;
    padding: 28px;
  }

  .catalog-management-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #cbd5e1;
    border-top-color: #0f172a;
    border-radius: 999px;
    animation: catalog-management-spin 800ms linear infinite;
  }

  .catalog-management-spinner.small {
    width: 14px;
    height: 14px;
    border-color: rgba(255, 255, 255, 0.45);
    border-top-color: #ffffff;
  }

  .catalog-management-toast {
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

  .catalog-management-toast-success {
    background: #059669;
  }

  .catalog-management-toast-error {
    background: #dc2626;
  }

  @keyframes catalog-management-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1120px) {
    .catalog-management-form-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .catalog-management-header {
      align-items: stretch;
      flex-direction: column;
    }

    .catalog-management-refresh,
    .catalog-management-form-actions button {
      width: 100%;
    }

    .catalog-management-form-grid {
      grid-template-columns: 1fr;
    }
  }
`;

export default CatalogManagement;
