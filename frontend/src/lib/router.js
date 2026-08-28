export function getPathname() {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

export function subscribeToPath(onChange) {
  const handleChange = () => onChange(getPathname());

  window.addEventListener("popstate", handleChange);
  return () => window.removeEventListener("popstate", handleChange);
}
