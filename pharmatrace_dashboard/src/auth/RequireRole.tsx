import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { Role } from '../lib/api';
import ChangePasswordPage from '../pages/ChangePassword';

// Mirrors the backend: super_admin passes every role check.
export default function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (user.must_change_password) return <ChangePasswordPage />;   // a temporary password must be replaced before anything else
  if (roles && user.role !== 'super_admin' && !roles.includes(user.role)) {
    return <Navigate to="/overview" replace />;
  }
  return <>{children}</>;
}
