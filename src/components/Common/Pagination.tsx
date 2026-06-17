import { memo } from "react";

type PaginationItem = number | "ellipsis-left" | "ellipsis-right";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis-left", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis-left", currentPage - 1, currentPage, currentPage + 1, "ellipsis-right", totalPages];
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const pages = getPaginationItems(safeCurrentPage, totalPages);

  return (
    <nav className="admin-pagination" aria-label="Pagination">
      <style>{styles}</style>

      <button
        type="button"
        className="admin-pagination-button admin-pagination-step"
        disabled={safeCurrentPage === 1}
        onClick={() => onPageChange(safeCurrentPage - 1)}
      >
        Trước
      </button>

      <div className="admin-pagination-pages">
        {pages.map((page) => {
          if (typeof page !== "number") {
            return (
              <span key={page} className="admin-pagination-ellipsis" aria-hidden="true">
                ...
              </span>
            );
          }

          const isActive = page === safeCurrentPage;

          return (
            <button
              key={page}
              type="button"
              className={isActive ? "admin-pagination-button active" : "admin-pagination-button"}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="admin-pagination-button admin-pagination-step"
        disabled={safeCurrentPage === totalPages}
        onClick={() => onPageChange(safeCurrentPage + 1)}
      >
        Sau
      </button>
    </nav>
  );
}

const styles = `
  .admin-pagination {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    border-top: 1px solid #e2e8f0;
    background: #ffffff;
    padding: 14px 16px;
  }

  .admin-pagination-pages {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .admin-pagination-button {
    min-width: 38px;
    height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    font-weight: 900;
    line-height: 1;
    padding: 0 12px;
  }

  .admin-pagination-button:hover:not(:disabled):not(.active) {
    border-color: #94a3b8;
    background: #f8fafc;
  }

  .admin-pagination-button.active {
    border-color: #0f172a;
    background: #0f172a;
    color: #ffffff;
  }

  .admin-pagination-button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.12);
  }

  .admin-pagination-button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .admin-pagination-step {
    min-width: 76px;
  }

  .admin-pagination-ellipsis {
    min-width: 28px;
    color: #64748b;
    font-size: 14px;
    font-weight: 900;
    text-align: center;
  }

  @media (max-width: 640px) {
    .admin-pagination {
      justify-content: center;
      padding: 12px;
    }

    .admin-pagination-pages {
      order: -1;
      width: 100%;
      justify-content: center;
    }

    .admin-pagination-button {
      min-width: 34px;
      height: 34px;
      padding: 0 10px;
    }

    .admin-pagination-step {
      flex: 1;
      min-width: 0;
    }
  }
`;

export default memo(Pagination);
