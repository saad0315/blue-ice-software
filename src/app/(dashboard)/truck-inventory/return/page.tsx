import { ReturnSheetForm } from '@/features/inventory/components/return-sheet-form';

export default function ReturnSheetPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">New Return Sheet</h1>
      </div>
      <ReturnSheetForm />
    </div>
  );
}
