import { Activity } from "lucide-react";

// Inline spinner for a submit button's own label — components/ui/Spinner is
// sized for a full-page loading state and always renders its own text
// label, so it doesn't fit next to button copy.
export function ButtonSpinner() {
  return <Activity className="pulse-beat h-4 w-4" strokeWidth={2} aria-hidden="true" />;
}
