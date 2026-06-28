import { useCallback, useEffect, useMemo, useState } from "react";
import AiControl from "../components/AiControl";
import CatalogManagement from "../components/CatalogManagement";
import ProductInventory from "../components/ProductInventory";
import UserManagement from "../components/UserManagement";
import VoucherManagement from "../components/VoucherManagement";
import Pagination from "../components/Common/Pagination";
import { apiClient } from "../lib/api-client";

type ActiveTab =
  | "overview"
  | "orders"
  | "vouchers"
  | "ai-control"
  | "catalog"
  | "inventory"
  | "users";
type ToastType = "success" | "error";

interface AdminStats {
  totalRevenue: string | number;
  totalOrders: number;
  totalUsers: number;
  orderStatusCounts: {
    PENDING: number;
    PROCESSING: number;
    DELIVERED: number;
  };
}

interface AdminStatsResponse {
  data: AdminStats;
}

interface AdminOrderItem {
  id: number;
  quantity: number;
  product?: {
    id: number;
    name: string;
  };
}

interface AdminOrder {
  id: number;
  voucherId?: number | null;
  total: string | number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  items: AdminOrderItem[];
}

interface AdminOrdersResponse {
  data?: AdminOrder[];
  orders?: AdminOrder[];
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

interface ToastState {
  type: ToastType;
  message: string;
}

const QUEUE_BOARD_URL = "/api/v1/monitor";

const tabs: Array<{ id: ActiveTab; label: string }> = [
  { id: "overview", label: "Tổng quan" },
  { id: "orders", label: "Đơn hàng" },
  { id: "vouchers", label: "Voucher" },
  { id: "ai-control", label: "Cấu hình AI" },
  { id: "catalog", label: "Danh mục sản phẩm" },
  // { id: "inventory", label: "Tồn kho biến thể" },
  { id: "users", label: "Quản lý khách hàng" },
];

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const statusLabelByValue: Record<string, string> = {
  PENDING: "Chờ xử lý",
  PROCESSING: "Đang xử lý",
  PAID: "Đã thanh toán",
  SHIPPED: "Đang giao",
  COMPLETED: "Đã giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};

function formatCurrency(value: string | number) {
  return currencyFormatter.format(Number(value));
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);

    try {
      const response = await apiClient.get<AdminStatsResponse>("/admin/stats");
      setStats(response.data);
    } catch {
      showToast("error", "Không thể tải số liệu tổng quan.");
    } finally {
      setLoadingStats(false);
    }
  }, [showToast]);

  const fetchOrders = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoadingOrders(true);
    }

    try {
      const response = await apiClient.get<AdminOrdersResponse>(`/admin/orders?page=${page}&limit=10`);
      setOrders(response.data ?? response.orders ?? []);
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
      showToast("error", "Không thể tải danh sách đơn hàng.");
    } finally {
      setLoadingOrders(false);
    }
  }, [page, showToast]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const statusTotal = useMemo(() => {
    if (!stats) {
      return 0;
    }

    return (
      stats.orderStatusCounts.PENDING +
      stats.orderStatusCounts.PROCESSING +
      stats.orderStatusCounts.DELIVERED
    );
  }, [stats]);

  const updateOrderStatus = async (orderId: number, status: string) => {
    setUpdatingOrderId(orderId);

    try {
      await apiClient.put(`/admin/orders/${orderId}/status`, { status });
      showToast("success", "Đã cập nhật trạng thái đơn hàng.");
      await Promise.all([fetchOrders(false), fetchStats()]);
    } catch {
      showToast("error", "Không thể cập nhật trạng thái đơn hàng.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="admin-shell">
      <style>{styles}</style>

      {toast && (
        <div className={`admin-toast admin-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">AD</span>
          <div>
            <h1>Admin Panel</h1>
            <p>Quản trị vận hành</p>
          </div>
        </div>

        <nav className="admin-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "admin-nav-item active" : "admin-nav-item"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <a
            className="admin-nav-item admin-nav-link"
            href={QUEUE_BOARD_URL}
            target="_blank"
            rel="noreferrer"
          >
            <svg
              aria-hidden="true"
              className="admin-nav-icon"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M4 7c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              <path
                d="M4 7v5c0 1.66 3.58 3 8 3s8-1.34 8-3V7"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              <path
                d="M4 12v5c0 1.66 3.58 3 8 3s8-1.34 8-3v-5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span>Giám sát Queue (Redis)</span>
          </a>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <p className="admin-eyebrow">Trung tâm quản trị</p>
          <h2>Bảng điều khiển Admin</h2>
        </header>

        {activeTab === "overview" && (
          <section className="admin-section">
            <div className="kpi-grid">
              <article className="kpi-card">
                <span>Doanh thu</span>
                <strong>{loadingStats ? "..." : formatCurrency(stats?.totalRevenue ?? 0)}</strong>
              </article>
              <article className="kpi-card">
                <span>Đơn hàng</span>
                <strong>{loadingStats ? "..." : stats?.totalOrders ?? 0}</strong>
              </article>
              <article className="kpi-card">
                <span>Khách hàng</span>
                <strong>{loadingStats ? "..." : stats?.totalUsers ?? 0}</strong>
              </article>
            </div>

            <section className="content-panel">
              <div className="panel-title">
                <h3>Tỷ lệ trạng thái đơn hàng</h3>
                <p>Theo dõi nhanh đơn đã giao, đang xử lý và đang chờ xử lý.</p>
              </div>

              <div className="progress-list">
                {[
                  {
                    label: "Đã giao",
                    value: stats?.orderStatusCounts.DELIVERED ?? 0,
                    className: "progress-delivered",
                  },
                  {
                    label: "Đang xử lý",
                    value: stats?.orderStatusCounts.PROCESSING ?? 0,
                    className: "progress-processing",
                  },
                  {
                    label: "Chờ xử lý",
                    value: stats?.orderStatusCounts.PENDING ?? 0,
                    className: "progress-pending",
                  },
                ].map((item) => {
                  const percent = statusTotal > 0 ? Math.round((item.value / statusTotal) * 100) : 0;

                  return (
                    <div className="progress-row" key={item.label}>
                      <div className="progress-meta">
                        <span>{item.label}</span>
                        <span>
                          {item.value} đơn · {percent}%
                        </span>
                      </div>
                      <div className="progress-track">
                        <div className={`progress-fill ${item.className}`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </section>
        )}

        {activeTab === "orders" && (
          <section className="content-panel">
            <div className="panel-title">
              <h3>Quản lý đơn hàng</h3>
              <p>Cập nhật trạng thái giao hàng và theo dõi các đơn mới nhất.</p>
            </div>

            {loadingOrders ? (
              <div className="loading-line">
                <span className="spinner" />
                Đang tải danh sách đơn hàng...
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Phương thức thanh toán</th>
                      <th>Voucher</th>
                      <th>Mặt hàng</th>
                      <th>Tổng tiền</th>
                      <th>Trạng thái</th>
                      <th>Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const isUpdating = updatingOrderId === order.id;

                      return (
                        <tr key={order.id}>
                          <td>
                            <strong>#{order.id}</strong>
                            <span>{formatDate(order.createdAt)}</span>
                          </td>
                          <td>{order.paymentMethod}</td>
                          <td>{order.voucherId ? `#${order.voucherId}` : "Không có"}</td>
                          <td>{order.items.length} sản phẩm</td>
                          <td>{formatCurrency(order.total)}</td>
                          <td>
                            <span className={`status-pill status-${order.status.toLowerCase()}`}>
                              {statusLabelByValue[order.status] ?? order.status}
                            </span>
                          </td>
                          <td>
                            <div className="order-actions">
                              <select
                                value={order.status === "COMPLETED" ? "DELIVERED" : order.status}
                                disabled={isUpdating}
                                onChange={(event) => {
                                  void updateOrderStatus(order.id, event.target.value);
                                }}
                              >
                                <option value="PENDING">Chờ xử lý</option>
                                <option value="PROCESSING">Đang xử lý</option>
                                <option value="SHIPPED">Đang giao</option>
                                <option value="DELIVERED">Đã giao</option>
                                <option value="CANCELLED">Đã hủy</option>
                              </select>
                              <button
                                type="button"
                                disabled={isUpdating}
                                className="confirm-button"
                                onClick={() => {
                                  void updateOrderStatus(order.id, "DELIVERED");
                                }}
                              >
                                {isUpdating && <span className="spinner small" />}
                                Xác nhận giao hàng
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {orders.length === 0 && (
                  <p className="empty-state">Chưa có đơn hàng nào.</p>
                )}
              </div>
            )}

            {!loadingOrders && (
              <Pagination
                currentPage={page}
                totalPages={meta?.totalPages || 1}
                onPageChange={(nextPage) => setPage(nextPage)}
              />
            )}
          </section>
        )}

        {activeTab === "vouchers" && (
          <section className="admin-section">
            <VoucherManagement />
          </section>
        )}

        {activeTab === "ai-control" && (
          <section className="admin-section">
            <AiControl />
          </section>
        )}

        {activeTab === "catalog" && (
          <section className="admin-section">
            <CatalogManagement />
          </section>
        )}

        {activeTab === "inventory" && (
          <section className="admin-section">
            <ProductInventory />
          </section>
        )}

        {activeTab === "users" && (
          <section className="admin-section">
            <UserManagement />
          </section>
        )}
      </main>
    </div>
  );
}

const styles = `
  .admin-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    background: #f6f7fb;
    color: #0f172a;
    text-align: left;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .admin-sidebar {
    position: sticky;
    top: 0;
    min-height: 100vh;
    border-right: 1px solid #e2e8f0;
    background: #ffffff;
    padding: 24px 18px;
  }

  .admin-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 22px;
    border-bottom: 1px solid #e2e8f0;
  }

  .admin-brand-mark {
    display: inline-flex;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: #0f172a;
    color: #ffffff;
    font-weight: 800;
    font-size: 14px;
  }

  .admin-brand h1 {
    margin: 0;
    color: #0f172a;
    font-size: 18px;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .admin-brand p,
  .admin-header p,
  .panel-title p {
    margin: 0;
    color: #64748b;
    font-size: 13px;
  }

  .admin-nav {
    display: grid;
    gap: 8px;
    margin-top: 22px;
  }

  .admin-nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #334155;
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    text-align: left;
    padding: 0 14px;
    text-decoration: none;
  }

  .admin-nav-link {
    width: 100%;
  }

  .admin-nav-icon {
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
  }

  .admin-nav-item:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  .admin-nav-item.active {
    background: #0f172a;
    color: #ffffff;
  }

  .admin-main {
    min-width: 0;
    padding: 28px;
  }

  .admin-header {
    margin-bottom: 24px;
  }

  .admin-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 800;
  }

  .admin-header h2 {
    margin: 6px 0 0;
    color: #0f172a;
    font-size: 30px;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .admin-section {
    display: grid;
    gap: 18px;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .kpi-card,
  .content-panel {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
  }

  .kpi-card {
    padding: 20px;
  }

  .kpi-card span {
    display: block;
    color: #64748b;
    font-size: 14px;
    font-weight: 700;
  }

  .kpi-card strong {
    display: block;
    margin-top: 14px;
    color: #0f172a;
    font-size: 30px;
    line-height: 1.15;
    font-weight: 900;
  }

  .content-panel {
    padding: 20px;
  }

  .panel-title {
    margin-bottom: 18px;
  }

  .panel-title h3 {
    margin: 0 0 6px;
    color: #0f172a;
    font-size: 18px;
    letter-spacing: 0;
  }

  .progress-list {
    display: grid;
    gap: 16px;
  }

  .progress-meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
    color: #334155;
    font-size: 14px;
    font-weight: 700;
  }

  .progress-track {
    height: 12px;
    overflow: hidden;
    border-radius: 999px;
    background: #e2e8f0;
  }

  .progress-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 180ms ease;
  }

  .progress-delivered {
    background: #10b981;
  }

  .progress-processing {
    background: #f59e0b;
  }

  .progress-pending {
    background: #64748b;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 900px;
    border-collapse: collapse;
    font-size: 14px;
  }

  th {
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    padding: 12px;
  }

  td {
    border-top: 1px solid #e2e8f0;
    color: #334155;
    padding: 14px 12px;
    vertical-align: top;
  }

  td strong {
    display: block;
    color: #0f172a;
  }

  td span {
    display: inline-flex;
    margin-top: 4px;
    color: #64748b;
    font-size: 12px;
  }

  .status-pill {
    margin-top: 0;
    border-radius: 999px;
    padding: 5px 10px;
    font-weight: 800;
  }

  .status-pending {
    background: #fef3c7;
    color: #92400e;
  }

  .status-processing,
  .status-shipped {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .status-completed,
  .status-delivered {
    background: #d1fae5;
    color: #047857;
  }

  .status-cancelled {
    background: #fee2e2;
    color: #b91c1c;
  }

  .order-actions {
    display: grid;
    gap: 8px;
  }

  select,
  button {
    font: inherit;
  }

  select {
    height: 38px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    padding: 0 10px;
  }

  .confirm-button {
    display: inline-flex;
    height: 40px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 8px;
    background: #0f172a;
    color: #ffffff;
    cursor: pointer;
    font-size: 14px;
    font-weight: 800;
    padding: 0 14px;
  }

  .confirm-button:disabled,
  select:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .empty-state,
  .loading-line {
    color: #64748b;
    font-size: 14px;
  }

  .loading-line {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 18px 0;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #cbd5e1;
    border-top-color: #0f172a;
    border-radius: 999px;
    animation: admin-spin 800ms linear infinite;
  }

  .spinner.small {
    width: 14px;
    height: 14px;
    border-color: rgba(255, 255, 255, 0.45);
    border-top-color: #ffffff;
  }

  .admin-toast {
    position: fixed;
    top: 18px;
    right: 18px;
    z-index: 10;
    border-radius: 8px;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
    color: #ffffff;
    font-size: 14px;
    font-weight: 800;
    padding: 12px 14px;
  }

  .admin-toast-success {
    background: #059669;
  }

  .admin-toast-error {
    background: #dc2626;
  }

  @keyframes admin-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 920px) {
    .admin-shell {
      grid-template-columns: 1fr;
    }

    .admin-sidebar {
      position: static;
      min-height: auto;
      border-right: 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .admin-nav {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }

    .admin-nav-item {
      text-align: center;
    }

    .kpi-grid {
      grid-template-columns: 1fr;
    }
  }
`;

export default AdminDashboard;
