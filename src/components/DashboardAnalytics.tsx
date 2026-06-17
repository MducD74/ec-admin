import { useEffect, useMemo, useState } from "react";

interface AdminStats {
  totalRevenue: string | number;
  totalOrders: number;
  totalUsers: number;
  orderStatusCounts: {
    DELIVERED?: number;
    COMPLETED?: number;
    PROCESSING?: number;
    CANCELLED?: number;
  };
}

interface AdminStatsResponse {
  data: AdminStats;
}

const API_BASE_URL = "http://localhost:3000/api/v1";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

function formatCurrency(value: string | number) {
  return `${currencyFormatter.format(Number(value))}đ`;
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function DashboardAnalytics() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchStats() {
      setIsLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem("adminToken") ?? localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/admin/stats`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          throw new Error("Không thể tải dữ liệu thống kê.");
        }

        const payload = (await response.json()) as AdminStatsResponse;

        if (isMounted) {
          setStats(payload.data);
        }
      } catch {
        if (isMounted) {
          setError("Không thể tải dữ liệu thống kê từ hệ thống.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void fetchStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const statusValues = useMemo(() => {
    const delivered = stats?.orderStatusCounts.DELIVERED ?? stats?.orderStatusCounts.COMPLETED ?? 0;
    const processing = stats?.orderStatusCounts.PROCESSING ?? 0;
    const cancelled = stats?.orderStatusCounts.CANCELLED ?? 0;
    const total = delivered + processing + cancelled;

    return {
      delivered,
      processing,
      cancelled,
      deliveredPercent: total > 0 ? Math.round((delivered / total) * 100) : 0,
      processingPercent: total > 0 ? Math.round((processing / total) * 100) : 0,
      cancelledPercent: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    };
  }, [stats]);

  return (
    <section className="dashboard-analytics">
      <style>{styles}</style>

      <div className="dashboard-analytics-header">
        <p>Phân tích vận hành</p>
        <h2>Tổng quan kinh doanh</h2>
      </div>

      {error && <p className="dashboard-analytics-error">{error}</p>}

      <div className="dashboard-analytics-kpis">
        <article className="dashboard-analytics-card">
          <span>Tổng doanh thu (VND)</span>
          <strong>{isLoading ? "..." : formatCurrency(stats?.totalRevenue ?? 0)}</strong>
        </article>

        <article className="dashboard-analytics-card">
          <span>Tổng số Đơn hàng</span>
          <strong>{isLoading ? "..." : formatNumber(stats?.totalOrders ?? 0)}</strong>
        </article>

        <article className="dashboard-analytics-card">
          <span>Tổng số Khách hàng</span>
          <strong>{isLoading ? "..." : formatNumber(stats?.totalUsers ?? 0)}</strong>
        </article>
      </div>

      <section className="dashboard-analytics-chart">
        <div className="dashboard-analytics-chart-title">
          <h3>Biểu đồ Trạng thái Đơn hàng</h3>
          <p>Tỷ lệ đơn giao thành công, đang xử lý và đã hủy.</p>
        </div>

        <div className="dashboard-analytics-stacked-bar" aria-label="Tỷ lệ trạng thái đơn hàng">
          <span
            className="dashboard-analytics-bar delivered"
            style={{ width: `${statusValues.deliveredPercent}%` }}
          />
          <span
            className="dashboard-analytics-bar processing"
            style={{ width: `${statusValues.processingPercent}%` }}
          />
          <span
            className="dashboard-analytics-bar cancelled"
            style={{ width: `${statusValues.cancelledPercent}%` }}
          />
        </div>

        <div className="dashboard-analytics-progress-list">
          <div className="dashboard-analytics-progress-row">
            <div>
              <span className="dashboard-analytics-dot delivered" />
              Đơn giao thành công
            </div>
            <strong>
              {formatNumber(statusValues.delivered)} đơn · {statusValues.deliveredPercent}%
            </strong>
          </div>

          <div className="dashboard-analytics-progress-row">
            <div>
              <span className="dashboard-analytics-dot processing" />
              Đơn đang xử lý
            </div>
            <strong>
              {formatNumber(statusValues.processing)} đơn · {statusValues.processingPercent}%
            </strong>
          </div>

          <div className="dashboard-analytics-progress-row">
            <div>
              <span className="dashboard-analytics-dot cancelled" />
              Đơn đã hủy
            </div>
            <strong>
              {formatNumber(statusValues.cancelled)} đơn · {statusValues.cancelledPercent}%
            </strong>
          </div>
        </div>
      </section>
    </section>
  );
}

const styles = `
  .dashboard-analytics {
    display: grid;
    gap: 18px;
    color: #0f172a;
    text-align: left;
  }

  .dashboard-analytics-header p {
    margin: 0;
    color: #64748b;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .dashboard-analytics-header h2 {
    margin: 6px 0 0;
    color: #0f172a;
    font-size: 24px;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .dashboard-analytics-kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .dashboard-analytics-card,
  .dashboard-analytics-chart {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
  }

  .dashboard-analytics-card {
    padding: 20px;
  }

  .dashboard-analytics-card span {
    display: block;
    color: #64748b;
    font-size: 14px;
    font-weight: 800;
  }

  .dashboard-analytics-card strong {
    display: block;
    margin-top: 14px;
    color: #0f172a;
    font-size: 30px;
    line-height: 1.15;
    font-weight: 900;
  }

  .dashboard-analytics-chart {
    padding: 20px;
  }

  .dashboard-analytics-chart-title h3 {
    margin: 0;
    color: #0f172a;
    font-size: 18px;
    letter-spacing: 0;
  }

  .dashboard-analytics-chart-title p {
    margin: 6px 0 0;
    color: #64748b;
    font-size: 14px;
  }

  .dashboard-analytics-stacked-bar {
    display: flex;
    height: 18px;
    overflow: hidden;
    border-radius: 999px;
    background: #e2e8f0;
    margin-top: 20px;
  }

  .dashboard-analytics-bar {
    display: block;
    min-width: 0;
    height: 100%;
    transition: width 180ms ease;
  }

  .dashboard-analytics-bar.delivered,
  .dashboard-analytics-dot.delivered {
    background: #10b981;
  }

  .dashboard-analytics-bar.processing,
  .dashboard-analytics-dot.processing {
    background: #f59e0b;
  }

  .dashboard-analytics-bar.cancelled,
  .dashboard-analytics-dot.cancelled {
    background: #ef4444;
  }

  .dashboard-analytics-progress-list {
    display: grid;
    gap: 12px;
    margin-top: 18px;
  }

  .dashboard-analytics-progress-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: #334155;
    font-size: 14px;
  }

  .dashboard-analytics-progress-row div {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    font-weight: 800;
  }

  .dashboard-analytics-progress-row strong {
    color: #0f172a;
    font-weight: 900;
  }

  .dashboard-analytics-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
  }

  .dashboard-analytics-error {
    border: 1px solid #fecaca;
    border-radius: 8px;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 14px;
    margin: 0;
    padding: 12px 14px;
  }

  @media (max-width: 920px) {
    .dashboard-analytics-kpis {
      grid-template-columns: 1fr;
    }

    .dashboard-analytics-progress-row {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;

export default DashboardAnalytics;
