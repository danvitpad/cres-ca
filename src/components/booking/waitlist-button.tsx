/** --- YAML
 * name: WaitlistButton
 * description: Join waitlist button when no slots available — gated by master's Pro+ tier
 * --- */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { humanizeError } from '@/lib/format/error';

interface WaitlistButtonProps {
  masterId: string;
  desiredDate: string;
}

export function WaitlistButton({ masterId, desiredDate }: WaitlistButtonProps) {
  const t = useTranslations('booking');
  const { userId } = useAuthStore();
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    if (!userId) return;
    setLoading(true);

    const supabase = createClient();

    // Find the client record for this user+master
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('profile_id', userId)
      .eq('master_id', masterId)
      .single();

    if (!client) {
      toast.error('Please book at least once before joining the waitlist');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('waitlist').insert({
      client_id: client.id,
      master_id: masterId,
      desired_date: desiredDate,
    });

    if (error) {
      if (error.code === '23505') {
        toast.info(t('alreadyOnWaitlist'));
      } else {
        toast.error(humanizeError(error));
      }
    } else {
      setJoined(true);
      toast.success(t('waitlistJoined'));
    }
    setLoading(false);
  }

  if (joined) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm text-primary"
      >
        <Bell className="size-4" />
        {t('waitlistJoined')}
      </motion.div>
    );
  }

  return (
    <Button
      variant="outline"
      className="w-full gap-2"
      onClick={handleJoin}
      disabled={loading}
    >
      <Bell className="size-4" />
      {loading ? '...' : t('joinWaitlist')}
    </Button>
  );
}
