const DEFAULT_POST_LOGIN_PATH = "/";

export const sanitizeNextPath = (
  nextPath: string | null | undefined,
): string | null => {
  if (!nextPath) {
    return null;
  }

  const trimmedNextPath = nextPath.trim();
  if (!trimmedNextPath.startsWith("/") || trimmedNextPath.startsWith("//")) {
    return null;
  }

  if (trimmedNextPath.startsWith("/login")) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  return trimmedNextPath;
};

export const getCurrentRelativeUrl = () =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;

export const buildLoginRedirectPath = (
  nextPath: string = getCurrentRelativeUrl(),
) => {
  const loginUrl = new URL("/login", window.location.origin);
  const sanitizedNextPath = sanitizeNextPath(nextPath);

  if (sanitizedNextPath) {
    loginUrl.searchParams.set("next", sanitizedNextPath);
  }

  return `${loginUrl.pathname}${loginUrl.search}`;
};

export const redirectAfterLogin = (nextPath: string | null | undefined) => {
  const destination = sanitizeNextPath(nextPath) ?? DEFAULT_POST_LOGIN_PATH;
  window.location.assign(destination);
};
