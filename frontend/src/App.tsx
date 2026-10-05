import { Routes, Route } from "react-router-dom";
import Portal from "@/pages/Portal";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Portal />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Portal />} />
    </Routes>
  );
}
