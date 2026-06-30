import { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "./Common/Pagination";
import { apiClient } from "../lib/api-client";

type OrderStatus = "ALL" | "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
type ToastType = "success" | "error";

interface OrderItem {
  id: number;
  quantity: number;
  product?: {
    id: number;
    name: string;
    sku?: string;
  };
}

interface AdminOrder {
  id: number;
  voucherId?: number | null;
  total: string | number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
  items: OrderItem[];
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

const statusTabs: Array<{ value: OrderStatus; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xử lý" },
  { value: "PROCESSING", label: "Đang xử lý" },
  { value: "SHIPPED", label: "Đang giao" },
  { value: "DELIVERED", label: "Thành công" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const statusLabels: Record<string, string> = {
  PENDING: "Chờ xử lý",
  PROCESSING: "Đang xử lý",
  PAID: "Đã thanh toán",
  SHIPPED: "Đang giao",
  COMPLETED: "Thành công",
  DELIVERED: "Thành công",
  CANCELLED: "Đã hủy",
  FAILED: "Thất bại",
  REFUNDED: "Đã hoàn tiền",
};

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

function formatCurrency(value: string | number) {
  return currencyFormatter.format(Number(value));
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function normalizeStatus(status: string) {
  return status === "COMPLETED" ? "DELIVERED" : status;
}

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  return apiClient.request<T>(path, init);
}

function OrderManagement() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [activeStatus, setActiveStatus] = useState<OrderStatus>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await requestApi<AdminOrdersResponse>(`/admin/orders?page=${page}&limit=10`);
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
      setIsLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    if (activeStatus === "ALL") {
      return orders;
    }

    return orders.filter((order) => normalizeStatus(order.status) === activeStatus);
  }, [activeStatus, orders]);

  const updateOrderStatus = async (orderId: number, status: string) => {
    setUpdatingOrderId(orderId);

    try {
      await apiClient.put(`/admin/orders/${orderId}/status`, { status });
      showToast("success", "Đã cập nhật trạng thái đơn hàng.");
      // await Promise.all([fetchOrders(), fetchStats()]);
      await fetchOrders();
    } catch {
      showToast("error", "Không thể cập nhật trạng thái đơn hàng.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <section className="order-management">
      <style>{styles}</style>

      {toast && (
        <div className={`order-management-toast order-management-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      <div className="order-management-header">
        <div>
          <p>Quản trị đơn hàng</p>
          <h2>Danh sách đơn hàng</h2>
        </div>
        <button type="button" className="order-management-refresh" onClick={() => void fetchOrders()}>
          Tải lại
        </button>
      </div>

      <div className="order-management-tabs" role="tablist" aria-label="Lọc trạng thái đơn hàng">
        {statusTabs.map((tab) => {
          const isActive = activeStatus === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={isActive ? "order-management-tab active" : "order-management-tab"}
              onClick={() => setActiveStatus(tab.value)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="order-management-panel">
        {isLoading ? (
          <div className="order-management-loading">
            <span className="order-management-spinner" />
            Đang tải danh sách đơn hàng...
          </div>
        ) : (
          <div className="order-management-table-wrap">
            <table className="order-management-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Ngày đặt</th>
                  <th>Phương thức thanh toán</th>
                  <th>Sản phẩm</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái đơn hàng</th>
                  <th>Trạng thái thanh toán</th>
                  <th>Thao tác nhanh</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const normalizedStatus = normalizeStatus(order.status);
                  const isUpdating = updatingOrderId === order.id;

                  return (
                    <tr key={order.id}>
                      <td className="order-management-id">#{order.id}</td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td>{order.paymentMethod}</td>
                      <td>
                        <div className="order-management-products">
                          <strong>{order.items.length} sản phẩm</strong>
                          <span>
                            {order.items
                              .slice(0, 2)
                              .map((item) => item.product?.name)
                              .filter(Boolean)
                              .join(", ") || "Không có chi tiết"}
                          </span>
                        </div>
                      </td>
                      <td className="order-management-money">{formatCurrency(order.total)}</td>
                      <td>
                        <span className={`order-management-status status-${normalizedStatus.toLowerCase()}`}>
                          {statusLabels[normalizedStatus] ?? normalizedStatus}
                        </span>
                      </td>
                      <td>
                        <span className={`order-management-status status-${order.paymentStatus.toLowerCase()}`}>
                          {statusLabels[order.paymentStatus] ?? order.paymentStatus}
                        </span>
                      </td>
                      <td>
                        {/* <div className="order-management-actions">
                          {normalizedStatus === "PROCESSING" && (
                            <button
                              type="button"
                              className="order-management-action ship"
                              disabled={isUpdating}
                              onClick={() => void updateOrderStatus(order.id, "SHIPPED")}
                            >
                              {isUpdating ? <span className="order-management-spinner small" /> : null}
                              Giao hàng
                            </button>
                          )}

                          {normalizedStatus === "SHIPPED" && (
                            <button
                              type="button"
                              className="order-management-action complete"
                              disabled={isUpdating}
                              onClick={() => void updateOrderStatus(order.id, "DELIVERED")}
                            >
                              {isUpdating ? <span className="order-management-spinner small" /> : null}
                              ✅ Hoàn thành
                            </button>
                          )}

                          <button
                            type="button"
                            className="order-management-action cancel"
                            disabled={isUpdating || normalizedStatus === "CANCELLED"}
                            onClick={() => void updateOrderStatus(order.id, "CANCELLED")}
                          >
                            {isUpdating ? <span className="order-management-spinner small" /> : null}
                            ❌ Hủy đơn
                          </button>
                        </div> */}
                        <div className="order-actions">
                          <select
                            value={order.status === "COMPLETED" ? "SHIPPED" : order.status}
                            disabled={isUpdating}
                            onChange={(event) => {
                              void updateOrderStatus(order.id, event.target.value);
                            }}
                          >
                            <option value="PENDING">Chờ xử lý</option>
                            <option value="PROCESSING">Đang xử lý</option>
                            <option value="SHIPPED">Đã giao</option>
                            <option value="CANCELLED">Đã hủy</option>
                            <option value="COMPLETED">Đã hoàn thành</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredOrders.length === 0 && (
              <p className="order-management-empty">Không có đơn hàng nào trong trạng thái này.</p>
            )}
          </div>
        )}
        {!isLoading && (
          <Pagination
            currentPage={page}
            totalPages={meta?.totalPages || 1}
            onPageChange={(nextPage) => setPage(nextPage)}
          />
        )}
      </div>
    </section>
  );
}

const styles = `
  .order-management {
    color: #0f172a;
    text-align: left;
  }

  .order-management-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
  }

  .order-management-header p {
    margin: 0;
    color: #64748b;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .order-management-header h2 {
    margin: 6px 0 0;
    color: #0f172a;
    font-size: 24px;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .order-management-refresh,
  .order-management-tab,
  .order-management-action {
    font: inherit;
  }

  .order-management-refresh {
    height: 40px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    cursor: pointer;
    font-size: 14px;
    font-weight: 800;
    padding: 0 14px;
  }

  .order-management-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .order-management-tab {
    height: 38px;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    background: #ffffff;
    color: #334155;
    cursor: pointer;
    font-size: 14px;
    font-weight: 800;
    padding: 0 14px;
  }

  .order-management-tab.active {
    border-color: #0f172a;
    background: #0f172a;
    color: #ffffff;
  }

  .order-management-panel {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
  }

  .order-management-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #64748b;
    font-size: 14px;
    padding: 28px;
  }

  .order-management-table-wrap {
    overflow-x: auto;
  }

  .order-management-table {
    width: 100%;
    min-width: 980px;
    border-collapse: collapse;
    font-size: 14px;
  }

  .order-management-table th {
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.04em;
    padding: 13px 14px;
    text-align: left;
    text-transform: uppercase;
  }

  .order-management-table td {
    border-top: 1px solid #e2e8f0;
    color: #334155;
    padding: 15px 14px;
    vertical-align: top;
  }

  .order-management-id,
  .order-management-money {
    color: #0f172a;
    font-weight: 900;
  }

  .order-management-products {
    display: grid;
    gap: 4px;
  }

  .order-management-products strong {
    color: #0f172a;
  }

  .order-management-products span {
    color: #64748b;
    font-size: 12px;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .order-management-status {
    display: inline-flex;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 900;
    padding: 6px 10px;
  }

  .status-pending {
    background: #fef3c7;
    color: #92400e;
  }

  .status-processing {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .status-shipped {
    background: #e0e7ff;
    color: #4338ca;
  }

  .status-delivered {
    background: #d1fae5;
    color: #047857;
  }

  .status-cancelled {
    background: #fee2e2;
    color: #b91c1c;
  }

  .order-management-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .order-management-action {
    display: inline-flex;
    min-height: 36px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 0;
    border-radius: 8px;
    color: #ffffff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 900;
    padding: 8px 12px;
    white-space: nowrap;
  }

  .order-management-action.ship {
    background: #2563eb;
  }

  .order-management-action.complete {
    background: #059669;
  }

  .order-management-action.cancel {
    background: #dc2626;
  }

  .order-management-action:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .order-management-empty {
    color: #64748b;
    font-size: 14px;
    margin: 0;
    padding: 28px;
  }

  .order-management-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #cbd5e1;
    border-top-color: #0f172a;
    border-radius: 999px;
    animation: order-management-spin 800ms linear infinite;
  }

  .order-management-spinner.small {
    width: 14px;
    height: 14px;
    border-color: rgba(255, 255, 255, 0.45);
    border-top-color: #ffffff;
  }

  .order-management-toast {
    position: fixed;
    top: 18px;
    right: 18px;
    z-index: 20;
    border-radius: 8px;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
    color: #ffffff;
    font-size: 14px;
    font-weight: 900;
    padding: 12px 14px;
  }

  .order-management-toast-success {
    background: #059669;
  }

  .order-management-toast-error {
    background: #dc2626;
  }

  @keyframes order-management-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 720px) {
    .order-management-header {
      align-items: stretch;
      flex-direction: column;
    }

    .order-management-refresh {
      width: 100%;
    }
  }
`;

export default OrderManagement;
