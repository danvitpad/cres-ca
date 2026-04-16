/** --- YAML
 * name: Telegram Webhook
 * description: Handles incoming Telegram bot updates — /start command, deep links, help
 * --- */

import { NextResponse } from 'next/server';
import { sendMessage } from '@/lib/telegram/bot';
import { createClient } from '@/lib/supabase/server';

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from: { id: number; first_name: string; last_name?: string };
    text?: string;
  };
}

export async function POST(request: Request) {
  const update: TelegramUpdate = await request.json();

  if (!update.message?.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = update.message.chat.id;
  const text = update.message.text;
  const telegramId = update.message.from.id;
  const firstName = update.message.from.first_name;

  const appUrl = `${process.env.NEXT_PUBLIC_APP_URL}/telegram`;

  // /start [param]
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const param = parts[1];

    if (param?.startsWith('linkmaster_')) {
      const token = param.replace('linkmaster_', '');
      await handleMasterAccountLink(chatId, telegramId, token);
    } else if (param?.startsWith('master_')) {
      const inviteCode = param.replace('master_', '');
      await handleMasterLink(chatId, telegramId, inviteCode, firstName);
    } else {
      await sendMessage(
        chatId,
        `👋 Добро пожаловать в <b>CRES-CA</b>, ${firstName}!\n\nНайди лучших мастеров, записывайся в пару тапов и получай бонусы.\n\nОткрой приложение, чтобы начать:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '✨ Открыть CRES-CA', web_app: { url: appUrl } }]],
          },
        },
      );
    }

    return NextResponse.json({ ok: true });
  }

  // /app — quick-open
  if (text.startsWith('/app')) {
    await sendMessage(chatId, '📱 Открыть CRES-CA:', {
      reply_markup: {
        inline_keyboard: [[{ text: '✨ Открыть', web_app: { url: appUrl } }]],
      },
    });
    return NextResponse.json({ ok: true });
  }

  // /help
  if (text.startsWith('/help')) {
    await sendMessage(
      chatId,
      '💡 <b>Команды CRES-CA:</b>\n\n/start — запуск\n/app — открыть приложение\n/help — справка\n\nВсе услуги, мастера и записи доступны внутри мини-приложения.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '✨ Открыть CRES-CA', web_app: { url: appUrl } }]],
        },
      },
    );
    return NextResponse.json({ ok: true });
  }

  // Fallback
  await sendMessage(chatId, 'Нажми /start чтобы начать, или открой приложение ниже.', {
    reply_markup: {
      inline_keyboard: [[{ text: '✨ Открыть CRES-CA', web_app: { url: appUrl } }]],
    },
  });

  return NextResponse.json({ ok: true });
}

async function handleMasterAccountLink(chatId: number, telegramId: number, token: string) {
  const supabase = await createClient();

  const { data: tokenRow } = await supabase
    .from('telegram_link_tokens')
    .select('profile_id, consumed_at, created_at')
    .eq('token', token)
    .single();

  if (!tokenRow) {
    await sendMessage(chatId, '❌ Ссылка недействительна или устарела.');
    return;
  }
  if (tokenRow.consumed_at) {
    await sendMessage(chatId, '❌ Эта ссылка уже использована.');
    return;
  }

  const ageMs = Date.now() - new Date(tokenRow.created_at).getTime();
  if (ageMs > 15 * 60 * 1000) {
    await sendMessage(chatId, '❌ Ссылка просрочена (действует 15 минут). Сгенерируй новую в настройках.');
    return;
  }

  const { error: profErr } = await supabase
    .from('profiles')
    .update({ telegram_id: String(telegramId) })
    .eq('id', tokenRow.profile_id);

  if (profErr) {
    await sendMessage(chatId, '❌ Не получилось связать аккаунт. Попробуй ещё раз.');
    return;
  }

  await supabase
    .from('telegram_link_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('token', token);

  await sendMessage(
    chatId,
    '✅ <b>Telegram подключён!</b>\n\nТеперь ты будешь получать уведомления о новых записях и отменах прямо сюда.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '📅 Открыть календарь', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram/m/home` } }]],
      },
    },
  );
}

async function handleMasterLink(chatId: number, telegramId: number, inviteCode: string, firstName: string) {
  const supabase = await createClient();

  // Find master by invite code
  const { data: master } = await supabase
    .from('masters')
    .select('id, profile:profiles!masters_profile_id_fkey(full_name)')
    .eq('invite_code', inviteCode)
    .single();

  if (!master) {
    await sendMessage(chatId, '❌ Master not found. The invite link may be invalid.');
    return;
  }

  const masterName = (master.profile as unknown as { full_name: string })?.full_name || 'Master';

  // Link client to master via client_master_links
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_id', String(telegramId))
    .single();

  if (profile) {
    await supabase.from('client_master_links').upsert({
      profile_id: profile.id,
      master_id: master.id,
    }, { onConflict: 'profile_id,master_id' });
  }

  await sendMessage(chatId, `✅ Ты подписан на <b>${masterName}</b>!\n\nОткрой приложение, чтобы записаться:`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: `📅 Записаться к ${masterName}`, web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram?startapp=master_${master.id}` } },
      ]],
    },
  });
}
