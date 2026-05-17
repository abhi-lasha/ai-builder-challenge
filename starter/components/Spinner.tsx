/**
 * Spinner — accessible loading indicator.
 * Always includes a visually-hidden label for screen readers.
 */

type Props = {
  label?: string;
  size?: "sm" | "md" | "lg";
};

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
};

export function Spinner({ label = "Loading…", size = "md" }: Props) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <span
        className={`block rounded-full border-gray-300 border-t-blue-600 animate-spin ${SIZE[size]}`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
