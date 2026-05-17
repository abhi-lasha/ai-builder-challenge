import Link from "next/link";

/**
 * Tech landing page — entry point for lab technicians.
 * Mobile-first: large tap targets, clear workflow labels, no noise.
 */

const WORKFLOWS = [
  {
    href: "/tech/receive",
    label: "Receive",
    description: "New asset arriving at the dock",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
      </svg>
    ),
    color: "border-blue-200 bg-blue-50 hover:bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    href: "/tech/store",
    label: "Store",
    description: "Move asset into storage",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    color: "border-amber-200 bg-amber-50 hover:bg-amber-100",
    iconColor: "text-amber-600",
  },
  {
    href: "/tech/deploy",
    label: "Deploy",
    description: "Rack an asset into service",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-13.5 0v-1.5A2.25 2.25 0 017.5 10.5h9a2.25 2.25 0 012.25 2.25v1.5m-13.5 6h13.5" />
      </svg>
    ),
    color: "border-green-200 bg-green-50 hover:bg-green-100",
    iconColor: "text-green-600",
  },
  {
    href: "/tech/transfer",
    label: "Transfer",
    description: "Hand off custody to another person",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
      </svg>
    ),
    color: "border-purple-200 bg-purple-50 hover:bg-purple-100",
    iconColor: "text-purple-600",
  },
];

export default function TechPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Scan workflows</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select the action that matches what you&apos;re doing with the asset.
        </p>
      </div>

      <nav aria-label="Scan workflow options">
        <ul className="space-y-3">
          {WORKFLOWS.map((w) => (
            <li key={w.href}>
              <Link
                href={w.href}
                className={`flex items-center gap-4 rounded-xl border-2 p-5 transition-colors ${w.color} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              >
                <span className={`flex-shrink-0 ${w.iconColor}`}>{w.icon}</span>
                <div>
                  <div className="text-base font-semibold text-gray-900">{w.label}</div>
                  <div className="text-sm text-gray-600">{w.description}</div>
                </div>
                <svg
                  className="ml-auto h-5 w-5 flex-shrink-0 text-gray-400"
                  aria-hidden="true"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
