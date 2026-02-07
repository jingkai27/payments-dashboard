type Status = 'success' | 'warning' | 'error' | 'info' | 'pending';

interface StatusBadgeProps {
  status: Status;
  label: string;
}

const statusStyles: Record<Status, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  pending: 'bg-gray-100 text-gray-800',
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}
    >
      {label}
    </span>
  );
}
