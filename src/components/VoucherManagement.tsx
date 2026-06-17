import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Pagination from "./Common/Pagination";
import { apiClient } from "../lib/api-client";

type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
type ToastType = "success" | "error";

interface Voucher {
  id: number;
  code: string;
  description?: string | null;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number;
  maxDiscountValue?: number | null;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
}

interface VouchersResponse {
  data?: Voucher[];
  vouchers?: Voucher[];
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

interface VoucherFormState {
  code: string;
  discountType: DiscountType;
  discountValue: string;
  minOrderValue: string;
  maxDiscountValue: string;
  usageLimit: string;
  description: string;
}

interface ToastState {
  type: ToastType;
  message: string;
}

const initialFormState: VoucherFormState = {
  code: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  minOrderValue: "",
  maxDiscountValue: "",
  usageLimit: "",
  description: "",
};

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  return apiClient.request<T>(path, init);
}

function formatCurrency(value: number) {
  return currencyFormatter.format(Number(value));
}

function formatDiscountType(value: DiscountType) {
  return value === "PERCENTAGE" ? "Phần trăm" : "Số tiền cố định";
}

function formatDiscountValue(voucher: Voucher) {
  if (voucher.discountType === "PERCENTAGE") {
    return `${voucher.discountValue}%`;
  }

  return formatCurrency(voucher.discountValue);
}

function getVouchers(response: VouchersResponse) {
  return response.data ?? response.vouchers ?? [];
}

function VoucherManagement() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [formState, setFormState] = useState<VoucherFormState>(initialFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [togglingVoucherId, setTogglingVoucherId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const visibleVouchers = useMemo(() => vouchers, [vouchers]);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchVouchers = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await requestApi<VouchersResponse>(`/admin/vouchers?page=${page}&limit=10`);
      setVouchers(getVouchers(response));
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
      showToast("error", "Không thể tải danh sách voucher.");
    } finally {
      setIsLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => {
    void fetchVouchers();
  }, [fetchVouchers]);

  const updateFormField = (field: keyof VoucherFormState, value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  };

  const toggleVoucher = async (voucher: Voucher) => {
    setTogglingVoucherId(voucher.id);

    try {
      await requestApi(`/admin/vouchers/${voucher.id}/toggle`, {
        method: "PUT",
      });
      showToast("success", voucher.isActive ? "Đã tắt mã voucher." : "Đã bật mã voucher.");
      await fetchVouchers();
    } catch {
      showToast("error", "Không thể cập nhật trạng thái voucher.");
    } finally {
      setTogglingVoucherId(null);
    }
  };

  const createVoucher = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);

    try {
      await requestApi("/admin/vouchers", {
        method: "POST",
        body: JSON.stringify({
          code: formState.code.trim(),
          discountType: formState.discountType,
          discountValue: Number(formState.discountValue),
          minOrderValue: Number(formState.minOrderValue || 0),
          maxDiscountValue: formState.maxDiscountValue ? Number(formState.maxDiscountValue) : null,
          usageLimit: Number(formState.usageLimit),
          description: formState.description.trim(),
        }),
      });
      setFormState(initialFormState);
      showToast("success", "Đã thêm mã voucher mới.");
      await fetchVouchers();
    } catch {
      showToast("error", "Không thể thêm mã voucher mới.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="voucher-management">
      <style>{styles}</style>

      {toast && (
        <div className={`voucher-management-toast voucher-management-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      <div className="voucher-management-header">
        <div>
          <p>Quản trị khuyến mãi</p>
          <h2>Quản lý 50 mã giảm giá</h2>
        </div>
        <button type="button" className="voucher-management-refresh" onClick={() => void fetchVouchers()}>
          Tải lại danh sách
        </button>
      </div>

      <form className="voucher-management-form" onSubmit={(event) => void createVoucher(event)}>
        <div className="voucher-management-form-title">
          <h3>Thêm mã Voucher mới</h3>
          <p>Nhập thông tin mã giảm giá để tạo chương trình khuyến mãi mới.</p>
        </div>

        <div className="voucher-management-form-grid">
          <label>
            Mã voucher
            <input
              required
              value={formState.code}
              onChange={(event) => updateFormField("code", event.target.value)}
              placeholder="Ví dụ: SUMMER50"
            />
          </label>

          <label>
            Loại giảm
            <select
              value={formState.discountType}
              onChange={(event) => updateFormField("discountType", event.target.value as DiscountType)}
            >
              <option value="PERCENTAGE">Phần trăm</option>
              <option value="FIXED_AMOUNT">Số tiền cố định</option>
            </select>
          </label>

          <label>
            Giá trị giảm
            <input
              required
              min="0"
              type="number"
              value={formState.discountValue}
              onChange={(event) => updateFormField("discountValue", event.target.value)}
              placeholder="Ví dụ: 10"
            />
          </label>

          <label>
            Đơn tối thiểu
            <input
              min="0"
              type="number"
              value={formState.minOrderValue}
              onChange={(event) => updateFormField("minOrderValue", event.target.value)}
              placeholder="Ví dụ: 500000"
            />
          </label>

          <label>
            Giảm tối đa
            <input
              min="0"
              type="number"
              value={formState.maxDiscountValue}
              onChange={(event) => updateFormField("maxDiscountValue", event.target.value)}
              placeholder="Ví dụ: 200000"
            />
          </label>

          <label>
            Giới hạn lượt dùng
            <input
              required
              min="1"
              type="number"
              value={formState.usageLimit}
              onChange={(event) => updateFormField("usageLimit", event.target.value)}
              placeholder="Ví dụ: 100"
            />
          </label>
        </div>

        <label className="voucher-management-description">
          Mô tả tiếng Việt
          <textarea
            value={formState.description}
            onChange={(event) => updateFormField("description", event.target.value)}
            placeholder="Ví dụ: Giảm giá dành cho khách hàng mua laptop trong tháng này."
          />
        </label>

        <div className="voucher-management-form-actions">
          <button type="submit" disabled={isCreating}>
            {isCreating && <span className="voucher-management-spinner small" />}
            Thêm mã Voucher mới
          </button>
        </div>
      </form>

      <div className="voucher-management-panel">
        {isLoading ? (
          <div className="voucher-management-loading">
            <span className="voucher-management-spinner" />
            Đang tải danh sách voucher...
          </div>
        ) : (
          <div className="voucher-management-table-wrap">
            <table className="voucher-management-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Loại giảm</th>
                  <th>Giá trị</th>
                  <th>Đơn tối thiểu</th>
                  <th>Đã dùng / Giới hạn</th>
                  <th>Trạng thái</th>
                  <th>Bật/Tắt</th>
                </tr>
              </thead>
              <tbody>
                {visibleVouchers.map((voucher) => {
                  const isToggling = togglingVoucherId === voucher.id;

                  return (
                    <tr key={voucher.id}>
                      <td>
                        <strong>{voucher.code}</strong>
                        {voucher.description && <span>{voucher.description}</span>}
                      </td>
                      <td>{formatDiscountType(voucher.discountType)}</td>
                      <td className="voucher-management-money">{formatDiscountValue(voucher)}</td>
                      <td>{formatCurrency(voucher.minOrderValue)}</td>
                      <td>
                        {voucher.usedCount} / {voucher.usageLimit}
                      </td>
                      <td>
                        <span
                          className={
                            voucher.isActive
                              ? "voucher-management-status active"
                              : "voucher-management-status inactive"
                          }
                        >
                          {voucher.isActive ? "Đang hoạt động" : "Đã tạm dừng"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={voucher.isActive ? "voucher-toggle on" : "voucher-toggle off"}
                          disabled={isToggling}
                          onClick={() => void toggleVoucher(voucher)}
                          aria-pressed={voucher.isActive}
                        >
                          {isToggling ? <span className="voucher-management-spinner small dark" /> : null}
                          {voucher.isActive ? "Tắt" : "Bật"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {visibleVouchers.length === 0 && (
              <p className="voucher-management-empty">Chưa có mã voucher nào.</p>
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
  .voucher-management {
    display: grid;
    gap: 18px;
    color: #0f172a;
    text-align: left;
  }

  .voucher-management-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
  }

  .voucher-management-header p,
  .voucher-management-form-title p {
    margin: 0;
    color: #64748b;
    font-size: 13px;
  }

  .voucher-management-header p {
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .voucher-management-header h2,
  .voucher-management-form-title h3 {
    margin: 6px 0 0;
    color: #0f172a;
    letter-spacing: 0;
    line-height: 1.2;
  }

  .voucher-management-header h2 {
    font-size: 24px;
  }

  .voucher-management-form-title h3 {
    font-size: 18px;
  }

  .voucher-management-refresh,
  .voucher-management-form-actions button,
  .voucher-toggle {
    font: inherit;
    font-weight: 900;
  }

  .voucher-management-refresh {
    height: 40px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    cursor: pointer;
    padding: 0 14px;
  }

  .voucher-management-form,
  .voucher-management-panel {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
  }

  .voucher-management-form {
    display: grid;
    gap: 16px;
    padding: 20px;
  }

  .voucher-management-form-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  .voucher-management-form label {
    display: grid;
    gap: 7px;
    color: #334155;
    font-size: 13px;
    font-weight: 800;
  }

  .voucher-management-form input,
  .voucher-management-form select,
  .voucher-management-form textarea {
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

  .voucher-management-form input,
  .voucher-management-form select {
    height: 42px;
  }

  .voucher-management-form textarea {
    min-height: 86px;
    resize: vertical;
  }

  .voucher-management-form input:focus,
  .voucher-management-form select:focus,
  .voucher-management-form textarea:focus {
    border-color: #0f172a;
    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
  }

  .voucher-management-description {
    grid-column: 1 / -1;
  }

  .voucher-management-form-actions {
    display: flex;
    justify-content: flex-end;
  }

  .voucher-management-form-actions button {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 8px;
    background: #0f172a;
    color: #ffffff;
    cursor: pointer;
    padding: 0 16px;
  }

  .voucher-management-form-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .voucher-management-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #64748b;
    font-size: 14px;
    padding: 28px;
  }

  .voucher-management-table-wrap {
    overflow-x: auto;
  }

  .voucher-management-table {
    width: 100%;
    min-width: 940px;
    border-collapse: collapse;
    font-size: 14px;
  }

  .voucher-management-table th {
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.04em;
    padding: 13px 14px;
    text-align: left;
    text-transform: uppercase;
  }

  .voucher-management-table td {
    border-top: 1px solid #e2e8f0;
    color: #334155;
    padding: 15px 14px;
    vertical-align: top;
  }

  .voucher-management-table td strong {
    display: block;
    color: #0f172a;
    font-weight: 900;
  }

  .voucher-management-table td span:not(.voucher-management-status):not(.voucher-management-spinner) {
    display: block;
    max-width: 260px;
    margin-top: 5px;
    color: #64748b;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .voucher-management-money {
    color: #0f172a;
    font-weight: 900;
  }

  .voucher-management-status {
    display: inline-flex;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 900;
    padding: 6px 10px;
  }

  .voucher-management-status.active {
    background: #d1fae5;
    color: #047857;
  }

  .voucher-management-status.inactive {
    background: #fee2e2;
    color: #b91c1c;
  }

  .voucher-toggle {
    display: inline-flex;
    min-width: 82px;
    height: 36px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 0;
    border-radius: 999px;
    color: #ffffff;
    cursor: pointer;
    padding: 0 12px;
  }

  .voucher-toggle.on {
    background: #dc2626;
  }

  .voucher-toggle.off {
    background: #059669;
  }

  .voucher-toggle:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .voucher-management-empty {
    margin: 0;
    color: #64748b;
    font-size: 14px;
    padding: 28px;
  }

  .voucher-management-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #cbd5e1;
    border-top-color: #0f172a;
    border-radius: 999px;
    animation: voucher-management-spin 800ms linear infinite;
  }

  .voucher-management-spinner.small {
    width: 14px;
    height: 14px;
    border-color: rgba(255, 255, 255, 0.45);
    border-top-color: #ffffff;
  }

  .voucher-management-spinner.dark {
    border-color: rgba(255, 255, 255, 0.45);
    border-top-color: #ffffff;
  }

  .voucher-management-toast {
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

  .voucher-management-toast-success {
    background: #059669;
  }

  .voucher-management-toast-error {
    background: #dc2626;
  }

  @keyframes voucher-management-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 920px) {
    .voucher-management-header {
      align-items: stretch;
      flex-direction: column;
    }

    .voucher-management-refresh,
    .voucher-management-form-actions button {
      width: 100%;
    }

    .voucher-management-form-grid {
      grid-template-columns: 1fr;
    }
  }
`;

export default VoucherManagement;
