/** --- YAML
 * name: ConsentForm
 * description: Digital consent form — auto-generated text based on service and client allergies, checkbox agreement
 * --- */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface ConsentFormProps {
  serviceName: string;
  masterName: string;
  clientName: string;
  allergies?: string[];
  onAgree: () => void;
  onDecline: () => void;
  loading?: boolean;
}

export function ConsentForm({
  serviceName,
  masterName,
  clientName,
  allergies = [],
  onAgree,
  onDecline,
  loading,
}: ConsentFormProps) {
  const t = useTranslations('consent');
  const [agreed, setAgreed] = useState(false);
  const today = format(new Date(), 'dd.MM.yyyy');

  const formText = generateConsentText({
    serviceName,
    masterName,
    clientName,
    allergies,
    date: today,
    t,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="size-5 text-primary" />
        {t('title')}
      </div>

      <Card className="bg-card/80 backdrop-blur border-border/50">
        <CardContent className="pt-4 max-h-[300px] overflow-y-auto">
          <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed whitespace-pre-line">
            {formText}
          </div>
        </CardContent>
      </Card>

      {allergies.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-400/30 px-3 py-2">
          <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-medium text-amber-600">{t('allergyWarning')}</p>
            <p className="text-muted-foreground mt-0.5">{allergies.join(', ')}</p>
          </div>
        </div>
      )}

      <label className="flex items-start gap-3 cursor-pointer group">
        <Checkbox
          checked={agreed}
          onCheckedChange={(val) => setAgreed(val === true)}
          className="mt-0.5"
        />
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
          {t('agreeText')}
        </span>
      </label>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onDecline}
          className="flex-1"
          disabled={loading}
        >
          {t('decline')}
        </Button>
        <Button
          onClick={onAgree}
          className="flex-1"
          disabled={!agreed || loading}
        >
          {t('agree')}
        </Button>
      </div>
    </div>
  );
}

function generateConsentText({
  serviceName,
  masterName,
  clientName,
  allergies,
  date,
  t,
}: {
  serviceName: string;
  masterName: string;
  clientName: string;
  allergies: string[];
  date: string;
  t: (key: string) => string;
}) {
  let text = t('formHeader')
    .replace('{date}', date)
    .replace('{clientName}', clientName);

  text += '\n\n' + t('formService').replace('{serviceName}', serviceName);
  text += '\n' + t('formMaster').replace('{masterName}', masterName);

  if (allergies.length > 0) {
    text += '\n\n' + t('formAllergies').replace('{allergies}', allergies.join(', '));
  }

  text += '\n\n' + t('formBody');
  text += '\n\n' + t('formSignature').replace('{date}', date);

  return text;
}

export function getConsentFormText(params: {
  serviceName: string;
  masterName: string;
  clientName: string;
  allergies: string[];
  date: string;
}) {
  // Plain text version for saving to DB (without i18n — English)
  let text = `INFORMED CONSENT FORM\nDate: ${params.date}\nClient: ${params.clientName}`;
  text += `\n\nService: ${params.serviceName}`;
  text += `\nSpecialist: ${params.masterName}`;

  if (params.allergies.length > 0) {
    text += `\n\nKnown allergies/contraindications: ${params.allergies.join(', ')}`;
  }

  text += '\n\nI, the undersigned, confirm that:';
  text += '\n1. I have been informed about the nature of the procedure.';
  text += '\n2. I have disclosed all known allergies and medical conditions.';
  text += '\n3. I understand the potential risks and expected outcomes.';
  text += '\n4. I consent to proceed with the service described above.';
  text += `\n\nDigitally signed on ${params.date}`;

  return text;
}
