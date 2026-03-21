import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated } from "../utils/auth";
import { buildLoginRedirectPath } from "../utils/redirect";

interface PrivateRouteProps {
  children: JSX.Element;
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const valid = await isAuthenticated();
      setAuthorized(valid);
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) return <div>Loading...</div>;

  return authorized ? (
    children
  ) : (
    <Navigate
      replace
      to={buildLoginRedirectPath(
        `${location.pathname}${location.search}${location.hash}`,
      )}
    />
  );
}
