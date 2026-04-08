/** --- YAML
 * name: LiqPayButton
 * description: LiqPay checkout button that submits payment form to LiqPay
 * --- */

'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';

interface LiqPayButtonProps {
  data: string;
  signature: string;
  label: string;
  className?: string;
  disabled?: boolean;
}

export function LiqPayButton({ data, signature, label, className, disabled }: LiqPayButtonProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form
        ref={formRef}
        method="POST"
        action="https://www.liqpay.ua/api/3/checkout"
        acceptCharset="utf-8"
        className="hidden"
      >
        <input type="hidden" name="data" value={data} />
        <input type="hidden" name="signature" value={signature} />
      </form>
      <Button
        onClick={() => formRef.current?.submit()}
        className={className}
        disabled={disabled}
        size="lg"
      >
        <CreditCard className="size-4 mr-2" />
        {label}
      </Button>
    </>
  );
}
