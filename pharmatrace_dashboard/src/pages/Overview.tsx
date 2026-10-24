import { useAuth } from '../auth/AuthContext';

// Placeholder: the real Overview (metrics, alerts) is built in Milestone 2.
export default function Overview() {
  const { user, logout } = useAuth();
  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-[28px] font-bold">Overview</h1>
      <p className="mt-2 text-sm text-mute">
        Signed in as {user?.name} ({user?.role}). Dashboard modules arrive in the next milestone.
      </p>
      <button onClick={logout} className="mt-6 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold">
        Sign out
      </button>
    </main>
  );
}
