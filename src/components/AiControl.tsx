import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";

type ToastType = "success" | "error";

interface InteractionUser {
  id?: number;
  email?: string | null;
  name?: string | null;
}

interface InteractionProduct {
  id?: number;
  name?: string | null;
}

interface Interaction {
  id: number;
  createdAt: string;
  actionType: "VIEW" | "ADD_TO_CART" | "PURCHASE" | string;
  user?: InteractionUser | null;
  product?: InteractionProduct | null;
}

interface InteractionsResponse {
  data?: Interaction[];
  interactions?: Interaction[];
}

interface AiConfig {
  collaborativeWeight: number;
  contentWeight: number;
  brandWeight: number;
}

interface AiConfigResponse {
  data?: AiConfig;
  config?: AiConfig;
}

interface ToastState {
  type: ToastType;
  message: string;
}

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const actionLabels: Record<string, string> = {
  VIEW: "Xem sản phẩm",
  ADD_TO_CART: "Thêm vào giỏ",
  PURCHASE: "Mua hàng",
};

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  return apiClient.request<T>(path, init);
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function getInteractions(response: InteractionsResponse) {
  return response.data ?? response.interactions ?? [];
}

function getAiConfig(response: AiConfigResponse) {
  return response.data ?? response.config;
}

function roundWeight(value: number) {
  return Math.round(value * 10) / 10;
}

function clampWeight(value: number) {
  return Math.min(1, Math.max(0, roundWeight(value)));
}

function calculateTotalWeight(
  collaborativeWeight: number,
  contentWeight: number,
  brandWeight: number,
) {
  return roundWeight(collaborativeWeight + contentWeight + brandWeight);
}

function AiControl() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [colWeight, setColWeight] = useState(0.4);
  const [conWeight, setConWeight] = useState(0.3);
  const [brandWeight, setBrandWeight] = useState(0.3);
  const [isTraining, setIsTraining] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(true);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const totalWeight = calculateTotalWeight(colWeight, conWeight, brandWeight);
  const isWeightTotalValid = Math.abs(totalWeight - 1) < 0.001;

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchInteractions = useCallback(async () => {
    setIsLoadingInteractions(true);
    setInteractionError(null);

    try {
      const response = await requestApi<InteractionsResponse>("/admin/ai/interactions");
      setInteractions(getInteractions(response));
    } catch {
      setInteractionError("Không thể tải dòng chảy tương tác từ hệ thống AI.");
    } finally {
      setIsLoadingInteractions(false);
    }
  }, []);

  const fetchAiConfig = useCallback(async () => {
    try {
      const response = await requestApi<AiConfigResponse>("/admin/ai-config");
      const config = getAiConfig(response);

      if (config) {
        setColWeight(config.collaborativeWeight);
        setConWeight(config.contentWeight);
        setBrandWeight(config.brandWeight);
      }
    } catch {
      showToast("error", "Không thể tải cấu hình trọng số AI.");
    }
  }, [showToast]);

  useEffect(() => {
    void fetchInteractions();
    void fetchAiConfig();
  }, [fetchInteractions, fetchAiConfig]);

  const saveAiConfig = async () => {
    if (!isWeightTotalValid) {
      showToast("error", "Tổng các trọng số phải bằng 1.0.");
      return;
    }

    setIsSavingConfig(true);

    try {
      await requestApi("/admin/ai-config", {
        method: "PUT",
        body: JSON.stringify({
          collaborativeWeight: colWeight,
          contentWeight: conWeight,
          brandWeight,
        }),
      });
      showToast("success", "Đã lưu cấu hình trọng số AI thành công.");
    } catch {
      showToast("error", "Không thể lưu cấu hình trọng số AI.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const updateCollaborativeWeight = (nextWeight: number) => {
    const normalizedWeight = clampWeight(nextWeight);

    setColWeight(normalizedWeight);
    setBrandWeight(clampWeight(1 - normalizedWeight - conWeight));
  };

  const updateContentWeight = (nextWeight: number) => {
    const normalizedWeight = clampWeight(nextWeight);

    setConWeight(normalizedWeight);
    setBrandWeight(clampWeight(1 - colWeight - normalizedWeight));
  };

  const trainAiModel = async () => {
    setIsTraining(true);

    try {
      await requestApi("/admin/ai/train", {
        method: "POST",
      });
      showToast("success", "Đã kích hoạt huấn luyện AI thành công.");
    } catch {
      showToast("error", "Không thể kích hoạt huấn luyện AI.");
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <section className="ai-control">
      <style>{styles}</style>

      {toast && (
        <div className={`ai-control-toast ai-control-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      <div className="ai-control-hero">
        <div>
          <p className="ai-control-eyebrow">AI vận hành</p>
          <h2>Trung tâm điều hành Trí tuệ nhân tạo</h2>
          <p className="ai-control-description">
            Kích hoạt huấn luyện lại mô hình gợi ý dựa trên dữ liệu hành vi mới nhất.
          </p>
        </div>

        <button
          type="button"
          className="ai-control-train-button"
          disabled={isTraining}
          onClick={trainAiModel}
        >
          {isTraining && <span className="ai-control-spinner light" />}
          Kích hoạt Huấn luyện AI
        </button>
      </div>

      {isTraining && (
        <div className="ai-control-training-status" role="status">
          <span className="ai-control-spinner" />
          AI đang tính toán lại ma trận tương tác...
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5 text-left shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Cấu hình gợi ý
            </p>
            <h3 className="mt-1 text-xl font-bold tracking-normal text-slate-950">
              Trọng số thuật toán AI
            </h3>
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSavingConfig || !isWeightTotalValid}
            onClick={() => void saveAiConfig()}
          >
            {isSavingConfig ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-slate-700">Lọc cộng tác</span>
              <span className="rounded-md bg-white px-2 py-1 text-sm font-black text-slate-950">
                {colWeight.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={colWeight}
              onChange={(event) => updateCollaborativeWeight(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-slate-950"
            />
          </label>

          <label className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-slate-700">Lọc nội dung</span>
              <span className="rounded-md bg-white px-2 py-1 text-sm font-black text-slate-950">
                {conWeight.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={conWeight}
              onChange={(event) => updateContentWeight(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-slate-950"
            />
          </label>

          <label className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-slate-700">Xu hướng thương hiệu</span>
              <span className="rounded-md bg-white px-2 py-1 text-sm font-black text-slate-950">
                {brandWeight.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={brandWeight}
              onChange={(event) => setBrandWeight(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-slate-950"
            />
          </label>
        </div>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-bold text-slate-700">
            Tổng trọng số hiện tại:{" "}
            <span className={isWeightTotalValid ? "text-emerald-700" : "text-red-600"}>
              {totalWeight.toFixed(1)}/1.0
            </span>
          </p>
          {!isWeightTotalValid && (
            <p className="mt-1 text-sm font-bold text-red-600">
              Tổng các trọng số phải bằng 1.0
            </p>
          )}
        </div>
      </section>

      <section className="ai-control-stream">
        <div className="ai-control-stream-header">
          <div>
            <p className="ai-control-eyebrow">Theo thời gian thực</p>
            <h3>Bảng dòng chảy tương tác (Live Interaction Stream)</h3>
          </div>
          <button
            type="button"
            className="ai-control-refresh-button"
            onClick={() => void fetchInteractions()}
          >
            Làm mới
          </button>
        </div>

        {isLoadingInteractions && (
          <div className="ai-control-loading">
            <span className="ai-control-spinner" />
            Đang tải dữ liệu tương tác...
          </div>
        )}

        {!isLoadingInteractions && interactionError && (
          <p className="ai-control-error">{interactionError}</p>
        )}

        {!isLoadingInteractions && !interactionError && interactions.length === 0 && (
          <p className="ai-control-empty">Chưa có hành vi người dùng nào được ghi nhận.</p>
        )}

        {!isLoadingInteractions && !interactionError && interactions.length > 0 && (
          <ol className="ai-control-timeline">
            {interactions.map((interaction) => {
              const actionLabel = actionLabels[interaction.actionType] ?? interaction.actionType;
              const actionClass = interaction.actionType.toLowerCase();

              return (
                <li className="ai-control-timeline-item" key={interaction.id}>
                  <div className={`ai-control-action-dot action-${actionClass}`} />
                  <div className="ai-control-timeline-card">
                    <div className="ai-control-timeline-meta">
                      <time>{formatDateTime(interaction.createdAt)}</time>
                      <span className={`ai-control-action-badge action-${actionClass}`}>
                        {actionLabel}
                      </span>
                    </div>
                    <p className="ai-control-user">
                      {interaction.user?.email ?? interaction.user?.name ?? "Khách vãng lai"}
                    </p>
                    <p className="ai-control-product">
                      Sản phẩm: {interaction.product?.name ?? "Không xác định"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </section>
  );
}

const styles = `
  .ai-control {
    display: grid;
    gap: 18px;
    color: #0f172a;
    text-align: left;
  }

  .ai-control-hero,
  .ai-control-stream {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
  }

  .ai-control-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 24px;
  }

  .ai-control-eyebrow {
    margin: 0;
    color: #64748b;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .ai-control-hero h2,
  .ai-control-stream h3 {
    margin: 6px 0 0;
    color: #0f172a;
    letter-spacing: 0;
    line-height: 1.2;
  }

  .ai-control-hero h2 {
    font-size: 26px;
  }

  .ai-control-stream h3 {
    font-size: 20px;
  }

  .ai-control-description {
    margin: 10px 0 0;
    max-width: 620px;
    color: #475569;
    font-size: 14px;
    line-height: 1.6;
  }

  .ai-control-train-button,
  .ai-control-refresh-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 8px;
    cursor: pointer;
    font: inherit;
    font-weight: 900;
    white-space: nowrap;
  }

  .ai-control-train-button {
    min-height: 52px;
    border: 0;
    background: #059669;
    color: #ffffff;
    font-size: 15px;
    padding: 0 22px;
  }

  .ai-control-refresh-button {
    height: 40px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #0f172a;
    font-size: 14px;
    padding: 0 14px;
  }

  .ai-control-train-button:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .ai-control-training-status,
  .ai-control-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #475569;
    font-size: 14px;
    font-weight: 700;
  }

  .ai-control-training-status {
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    background: #f0fdf4;
    color: #047857;
    padding: 14px 16px;
  }

  .ai-control-stream {
    padding: 22px;
  }

  .ai-control-stream-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }

  .ai-control-error,
  .ai-control-empty {
    border-radius: 8px;
    font-size: 14px;
    margin: 0;
    padding: 14px;
  }

  .ai-control-error {
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #b91c1c;
  }

  .ai-control-empty {
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #64748b;
  }

  .ai-control-timeline {
    position: relative;
    display: grid;
    gap: 14px;
    list-style: none;
    margin: 0;
    padding: 0 0 0 22px;
  }

  .ai-control-timeline::before {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 7px;
    width: 2px;
    border-radius: 999px;
    background: #e2e8f0;
    content: "";
  }

  .ai-control-timeline-item {
    position: relative;
  }

  .ai-control-action-dot {
    position: absolute;
    top: 18px;
    left: -21px;
    width: 12px;
    height: 12px;
    border: 2px solid #ffffff;
    border-radius: 999px;
    background: #64748b;
    box-shadow: 0 0 0 2px #e2e8f0;
  }

  .ai-control-timeline-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    padding: 14px;
  }

  .ai-control-timeline-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .ai-control-timeline-meta time {
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
  }

  .ai-control-action-badge {
    border-radius: 999px;
    color: #ffffff;
    font-size: 12px;
    font-weight: 900;
    padding: 5px 9px;
  }

  .action-view {
    background: #2563eb;
  }

  .action-add_to_cart {
    background: #f59e0b;
  }

  .action-purchase {
    background: #059669;
  }

  .ai-control-user {
    margin: 0;
    color: #0f172a;
    font-size: 15px;
    font-weight: 900;
  }

  .ai-control-product {
    margin: 5px 0 0;
    color: #475569;
    font-size: 14px;
  }

  .ai-control-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #cbd5e1;
    border-top-color: #0f172a;
    border-radius: 999px;
    animation: ai-control-spin 800ms linear infinite;
  }

  .ai-control-spinner.light {
    width: 16px;
    height: 16px;
    border-color: rgba(255, 255, 255, 0.45);
    border-top-color: #ffffff;
  }

  .ai-control-toast {
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

  .ai-control-toast-success {
    background: #059669;
  }

  .ai-control-toast-error {
    background: #dc2626;
  }

  @keyframes ai-control-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 760px) {
    .ai-control-hero,
    .ai-control-stream-header {
      align-items: stretch;
      flex-direction: column;
    }

    .ai-control-train-button,
    .ai-control-refresh-button {
      width: 100%;
    }

    .ai-control-timeline-meta {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;

export default AiControl;
