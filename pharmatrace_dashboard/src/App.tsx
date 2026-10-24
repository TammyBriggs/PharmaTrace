import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Overview from './pages/Overview';
import RequireRole from './auth/RequireRole';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/overview" element={<RequireRole><Overview /></RequireRole>} />
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}
