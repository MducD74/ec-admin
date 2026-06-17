import { useEffect, useState } from "react";
import AuthGuard from "./components/AuthGuard";
import AdminDashboard from "./pages/AdminDashboard";
import Login from "./pages/Login";

function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);

    window.addEventListener("popstate", updatePath);
    return () => window.removeEventListener("popstate", updatePath);
  }, []);

  if (path === "/login") {
    return <Login />;
  }

  return (
    <AuthGuard>
      <AdminDashboard />
    </AuthGuard>
  );
}

export default App;
