export function getPathname() {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

export function navigateTo(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function subscribeToPath(onChange) {
  const handleChange = () => onChange(getPathname());

  window.addEventListener("popstate", handleChange);
  return () => window.removeEventListener("popstate", handleChange);
}
