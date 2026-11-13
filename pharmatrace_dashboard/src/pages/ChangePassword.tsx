import { LogOut, ShieldPlus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import ChangePasswordForm from '../components/ChangePasswordForm';

/** Shown instead of the app while the account still has a temporary password. */
export default function ChangePasswordPage() {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas p-4">
      <div className="flex w-[456px] max-w-full flex-col gap-6 rounded-xl border border-line bg-white p-6 shadow-card sm:p-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-8 items-center justify-center rounded-lg bg-brand-tint">
            <ShieldPlus size={24} className="text-brand" aria-hidden />
          </div>
          <span className="text-xl font-semibold">PharmaTrace</span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold leading-normal sm:text-[28px]">Choose a new password</h1>
          <p className="text-sm text-mute">
            {user ? `Welcome, ${user.name}. ` : ''}You signed in with a temporary password. Replace it with one only you know to continue.
          </p>
        </div>
        <ChangePasswordForm currentLabel="Temporary password" />
      </div>
      <button onClick={logout} className="flex items-center gap-2 text-sm font-semibold text-brand hover:underline">
        <LogOut size={16} aria-hidden /> Sign out
      </button>
    </div>
  );
}
