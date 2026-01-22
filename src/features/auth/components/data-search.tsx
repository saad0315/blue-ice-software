import { SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { useUserFilters } from '@/features/auth/hooks/user-filters';
import { useDebounce } from '@/hooks/use-debounce';

export const DataSearch = () => {
  const [value, setValue] = useState('');

  const debouncedValue = useDebounce(value);
  const [_filters, setFilters] = useUserFilters();

  useEffect(() => {
    setFilters({ search: debouncedValue.trim().length > 0 ? debouncedValue : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  return (
    <div className="relative min-w-[180px] lg:w-[180px] ">
      <SearchIcon className="absolute left-2.5 top-[33%] size-4 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search for a Users"
        className=" min-h-10 w-full px-8 lg:w-[320px]"
      />
    </div>
  );
};
