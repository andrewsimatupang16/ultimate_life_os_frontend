import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import LoadingState from "@/components/LoadingState";
import type { ReactNode } from "react";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState label="Memeriksa sesi..." />;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
