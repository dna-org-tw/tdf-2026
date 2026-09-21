import { AlertCircle } from 'lucide-react';

interface AwardErrorProps {
  error: string;
}

export default function AwardError({ error }: AwardErrorProps) {
  if (!error) return null;

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-8 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-red-400 text-sm">{error}</p>
    </div>
  );
}
