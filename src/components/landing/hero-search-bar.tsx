/** --- YAML
 * name: HeroSearchBar
 * description: Fresha-style pill search bar — 3 fields + search button in a rounded white container
 * --- */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, MapPin, Clock, Scissors } from 'lucide-react';

export function HeroSearchBar() {
  const t = useTranslations('landing');
  const router = useRouter();
  const [service, setService] = useState('');
  const [location, setLocation] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (service) params.set('q', service);
    if (location) params.set('loc', location);
    router.push(`/masters?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSearch}
      className="mx-auto flex w-full max-w-[1136px] items-center overflow-hidden rounded-full bg-white shadow-lg shadow-black/5 dark:bg-zinc-900 dark:shadow-black/20"
      style={{ height: 64 }}
    >
      {/* Field 1: Service type */}
      <label className="flex flex-1 items-center gap-3 border-r border-zinc-100 px-6 dark:border-zinc-800">
        <Scissors className="size-5 shrink-0 text-zinc-400" />
        <input
          type="text"
          value={service}
          onChange={(e) => setService(e.target.value)}
          placeholder={t('searchService')}
          className="w-full bg-transparent text-[15px] font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </label>

      {/* Field 2: Location */}
      <label className="hidden flex-1 items-center gap-3 border-r border-zinc-100 px-6 dark:border-zinc-800 sm:flex">
        <MapPin className="size-5 shrink-0 text-zinc-400" />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t('searchLocation')}
          className="w-full bg-transparent text-[15px] font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </label>

      {/* Field 3: Time */}
      <label className="hidden flex-1 items-center gap-3 px-6 lg:flex">
        <Clock className="size-5 shrink-0 text-zinc-400" />
        <input
          type="text"
          placeholder={t('searchTime')}
          readOnly
          className="w-full cursor-pointer bg-transparent text-[15px] font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </label>

      {/* Search button */}
      <button
        type="submit"
        className="m-2 flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-zinc-800 active:scale-[0.97] dark:bg-violet-600 dark:hover:bg-violet-500"
        style={{ height: 48 }}
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">{t('searchButton')}</span>
      </button>
    </form>
  );
}
