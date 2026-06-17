import { useState } from "react";
import type { FormEvent } from "react";

interface AdminLoginResponse {
  token?: string;
  message?: string;
}

const API_BASE_URL = "http://localhost:3000/api/v1";

function navigateToDashboard() {
  window.history.replaceState(null, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function loginAdmin(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/admin-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json().catch(() => ({}))) as AdminLoginResponse;

  if (!response.ok || !payload.token) {
    throw new Error(payload.message ?? "Không thể đăng nhập. Vui lòng thử lại.");
  }

  return payload.token;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const token = await loginAdmin(email.trim(), password);
      localStorage.setItem("adminToken", token);
      localStorage.setItem("token", token);
      navigateToDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Đăng nhập không thành công.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-screen min-h-screen bg-slate-950 text-slate-950">
      <section className="login-shell mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1fr_440px]">
        <div className="login-copy hidden text-white lg:block">
          <p className="login-eyebrow text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
            Hệ thống quản trị
          </p>
          <h1 className="mt-5 max-w-2xl text-5xl font-bold leading-tight tracking-normal">
            Kiểm soát vận hành bán hàng trong một bảng điều khiển tập trung.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Đăng nhập bằng tài khoản quản trị để theo dõi doanh thu, xử lý đơn hàng, quản lý voucher và điều phối AI.
          </p>
        </div>

        <form
          className="login-card rounded-xl border border-white/15 bg-white p-8 shadow-2xl"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Admin Panel
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950">Đăng nhập</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Chỉ tài khoản có quyền ADMIN mới có thể truy cập khu vực này.
            </p>
          </div>

          {errorMessage && (
            <div className="login-alert mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="mt-7 grid gap-5">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Email
              <input
                required
                autoComplete="email"
                className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-200"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Mật khẩu
              <input
                required
                autoComplete="current-password"
                className="h-12 rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-200"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập mật khẩu quản trị"
              />
            </label>
          </div>

          <button
            className="login-submit mt-7 inline-flex h-12 w-full items-center justify-center rounded-lg bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default Login;
