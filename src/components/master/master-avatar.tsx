/** --- YAML
 * name: MasterAvatar
 * description: Avatar for public master page. Shows image if url loads, falls back to initial letter on 404/broken URL.
 * created: 2026-04-18
 * --- */

'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Props {
  url: string | null;
  name: string;
  className?: string;
}

export function MasterAvatar({ url, name, className }: Props) {
  const [failed, setFailed] = useState(false);
  const letter = (name || '?').slice(0, 1).toUpperCase();

  if (!url || failed) {
    return (
      <div className={`flex size-full items-center justify-center text-3xl font-bold text-neutral-400 ${className ?? ''}`}>
        {letter}
      </div>
    );
  }

  return (
    <Image
      src={url}
      alt={name}
      fill
      className={`object-cover ${className ?? ''}`}
      onError={() => setFailed(true)}
    />
  );
}
