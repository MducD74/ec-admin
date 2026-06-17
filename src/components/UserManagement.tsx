import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";

type UserRole = "ADMIN" | "USER" | string;

interface BrandAffinityScore {
  brand: string;
  score?: number;
  count?: number;
}

type BrandAffinity = string | Record<string, number> | BrandAffinityScore[] | null;

interface AdminUser {
  id: number;
  email: string;
  name?: string | null;
  role: UserRole;
  createdAt: string;
  brandAffinity?: BrandAffinity;
}

interface UsersResponse {
  data?: AdminUser[];
  users?: AdminUser[];
}

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

async function requestApi<T>(path: string): Promise<T> {
  return apiClient.request<T>(path);
}

function getUsers(response: UsersResponse) {
  return response.data ?? response.users ?? [];
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function getTopBrand(brandAffinity: BrandAffinity) {
  if (!brandAffinity) {
    return undefined;
  }

  if (typeof brandAffinity === "string") {
    return brandAffinity.trim() || undefined;
  }

  if (Array.isArray(brandAffinity)) {
    const sortedAffinities = [...brandAffinity].sort(
      (firstAffinity, secondAffinity) =>
        (secondAffinity.score ?? secondAffinity.count ?? 0) -
        (firstAffinity.score ?? firstAffinity.count ?? 0),
    );

    return sortedAffinities[0]?.brand;
  }

  const [topBrand] = Object.entries(brandAffinity).sort(
    ([, firstScore], [, secondScore]) => secondScore - firstScore,
  )[0] ?? [];

  return topBrand;
}

function formatBrandProfile(brandAffinity: BrandAffinity) {
  const topBrand = getTopBrand(brandAffinity);

  if (!topBrand) {
    return "Chưa đủ dữ liệu";
  }

  return `Tín đồ ${topBrand}`;
}

function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalUsers = useMemo(() => users.length, [users]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await requestApi<UsersResponse>("/admin/users");
      setUsers(getUsers(response));
    } catch {
      setError("Không thể tải danh sách người dùng.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  return (
    <section className="user-management">
      <style>{styles}</style>

      <div className="user-management-header">
        <div>
          <p>Quản trị khách hàng</p>
          <h2>Danh sách người dùng</h2>
        </div>
        <div className="user-management-actions">
          <span>{totalUsers} người dùng</span>
          <button type="button" onClick={() => void fetchUsers()}>
            Tải lại
          </button>
        </div>
      </div>

      {error && <p className="user-management-error">{error}</p>}

      <section className="user-management-panel">
        {isLoading ? (
          <div className="user-management-loading">
            <span className="user-management-spinner" />
            Đang tải danh sách người dùng...
          </div>
        ) : (
          <div className="user-management-table-wrap">
            <table className="user-management-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Tên hiển thị</th>
                  <th>Vai trò</th>
                  <th>Ngày tham gia</th>
                  <th>Hồ sơ Gu Thương hiệu (AI Profile)</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.email}</strong>
                    </td>
                    <td>{user.name ?? "Chưa cập nhật"}</td>
                    <td>
                      <span className={user.role === "ADMIN" ? "user-role admin" : "user-role user"}>
                        {user.role}
                      </span>
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <span className="brand-profile">
                        {formatBrandProfile(user.brandAffinity ?? null)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <p className="user-management-empty">Chưa có người dùng nào.</p>
            )}
          </div>
        )}
      </section>
    </section>
  );
}

const styles = `
  .user-management {
    display: grid;
    gap: 18px;
    color: #0f172a;
    text-align: left;
  }

  .user-management-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
  }

  .user-management-header p {
    margin: 0;
    color: #64748b;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .user-management-header h2 {
    margin: 6px 0 0;
    color: #0f172a;
    font-size: 24px;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .user-management-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .user-management-actions span {
    color: #64748b;
    font-size: 14px;
    font-weight: 800;
  }

  .user-management-actions button {
    height: 40px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    cursor: pointer;
    font: inherit;
    font-weight: 900;
    padding: 0 14px;
  }

  .user-management-panel {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
  }

  .user-management-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #64748b;
    font-size: 14px;
    padding: 28px;
  }

  .user-management-table-wrap {
    overflow-x: auto;
  }

  .user-management-table {
    width: 100%;
    min-width: 820px;
    border-collapse: collapse;
    font-size: 14px;
  }

  .user-management-table th {
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.04em;
    padding: 13px 14px;
    text-align: left;
    text-transform: uppercase;
  }

  .user-management-table td {
    border-top: 1px solid #e2e8f0;
    color: #334155;
    padding: 15px 14px;
    vertical-align: middle;
  }

  .user-management-table td strong {
    color: #0f172a;
    font-weight: 900;
  }

  .user-role,
  .brand-profile {
    display: inline-flex;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 900;
    padding: 6px 10px;
  }

  .user-role.admin {
    background: #e0e7ff;
    color: #4338ca;
  }

  .user-role.user {
    background: #f1f5f9;
    color: #475569;
  }

  .brand-profile {
    background: #fef3c7;
    color: #92400e;
  }

  .user-management-error,
  .user-management-empty {
    font-size: 14px;
    margin: 0;
    padding: 14px;
  }

  .user-management-error {
    border: 1px solid #fecaca;
    border-radius: 8px;
    background: #fef2f2;
    color: #b91c1c;
  }

  .user-management-empty {
    color: #64748b;
    padding: 28px;
  }

  .user-management-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #cbd5e1;
    border-top-color: #0f172a;
    border-radius: 999px;
    animation: user-management-spin 800ms linear infinite;
  }

  @keyframes user-management-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 720px) {
    .user-management-header {
      align-items: stretch;
      flex-direction: column;
    }

    .user-management-actions {
      align-items: stretch;
      flex-direction: column;
    }
  }
`;

export default UserManagement;
