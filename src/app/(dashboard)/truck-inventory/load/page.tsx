import { LoadSheetForm } from '@/features/inventory/components/load-sheet-form';

export default function LoadSheetPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">New Load Sheet</h1>
      </div>
      <LoadSheetForm />
    </div>
  );
}
