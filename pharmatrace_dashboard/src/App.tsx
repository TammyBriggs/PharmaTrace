import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Overview from './pages/Overview';
import ComingSoon from './pages/ComingSoon';
import Manufacturers from './pages/Manufacturers';
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
        <Route path="/batches" element={only(['regulator', 'manufacturer'], <Batches />)} />
        <Route path="/batches/:id" element={only(['regulator', 'manufacturer'], <BatchDetail />)} />
        <Route path="/analytics" element={only(['regulator'], <ComingSoon title="Scan Analytics" />)} />
        <Route path="/flag-reports" element={only(['regulator'], <ComingSoon title="Flag Reports" />)} />
        <Route path="/audit-log" element={only(['regulator'], <ComingSoon title="Audit Log" />)} />
      </Route>
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}
