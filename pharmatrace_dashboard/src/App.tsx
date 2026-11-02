import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Overview from './pages/Overview';
import FlagReports from './pages/FlagReports';
import ScanAnalytics from './pages/ScanAnalytics';
import AuditLog from './pages/AuditLog';
import Manufacturers from './pages/Manufacturers';
import ManufacturerDetail from './pages/ManufacturerDetail';
import Batches from './pages/Batches';
import BatchDetail from './pages/BatchDetail';
import BatchPrint from './pages/BatchPrint';
import AppShell from './components/AppShell';
import RequireRole from './auth/RequireRole';

const only = (roles: ('regulator' | 'manufacturer')[], el: ReactElement) => (
  <RequireRole roles={roles}>{el}</RequireRole>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/batches/:id/print" element={only(['regulator', 'manufacturer'], <BatchPrint />)} />
      <Route element={<RequireRole><AppShell /></RequireRole>}>
        <Route path="/overview" element={<Overview />} />
        <Route path="/manufacturers" element={only(['regulator'], <Manufacturers />)} />
        <Route path="/manufacturers/:id" element={only(['regulator'], <ManufacturerDetail />)} />
        <Route path="/batches" element={only(['regulator', 'manufacturer'], <Batches />)} />
        <Route path="/batches/:id" element={only(['regulator', 'manufacturer'], <BatchDetail />)} />
        <Route path="/analytics" element={only(['regulator'], <ScanAnalytics />)} />
        <Route path="/flag-reports" element={only(['regulator'], <FlagReports />)} />
        <Route path="/audit-log" element={only(['regulator'], <AuditLog />)} />
      </Route>
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}
