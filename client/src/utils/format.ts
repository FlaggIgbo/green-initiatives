export const formatUsd = (amount: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Email address is required.";
  if (!EMAIL_REGEX.test(trimmed)) {
    return "Please enter a valid email address (e.g. you@example.com).";
  }
  return null;
}
