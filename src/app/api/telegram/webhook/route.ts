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

  // Handle /start command
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const param = parts[1]; // e.g., "master_ABC123"

    if (param?.startsWith('master_')) {
      const inviteCode = param.replace('master_', '');
      await handleMasterLink(chatId, telegramId, inviteCode, firstName);
    } else {
      await sendMessage(chatId, `👋 Welcome to CRES-CA, ${firstName}!\n\nUse this bot to receive booking reminders and notifications.\n\nOpen the app to get started:`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '📱 Open CRES-CA', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram` } },
          ]],
        },
      });
    }

    // Link Telegram ID to profile if possible
    const supabase = await createClient();
    await supabase
      .from('profiles')
      .update({ telegram_id: String(telegramId) })
      .eq('telegram_id', String(telegramId)); // Only updates if already linked

    return NextResponse.json({ ok: true });
  }

  // Default help message
  await sendMessage(chatId, '💡 Use /start to begin.\n\nYou can also open the CRES-CA app directly from Telegram.', {
    reply_markup: {
      inline_keyboard: [[
        { text: '📱 Open App', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram` } },
      ]],
    },
  });

  return NextResponse.json({ ok: true });
}

async function handleMasterLink(chatId: number, telegramId: number, inviteCode: string, firstName: string) {
  const supabase = await createClient();

  // Find master by invite code
  const { data: master } = await supabase
    .from('masters')
    .select('id, profile:profiles(full_name)')
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

  await sendMessage(chatId, `✅ You're now connected to <b>${masterName}</b>!\n\nTap below to book an appointment:`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: `📅 Book with ${masterName}`, web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/book?master_id=${master.id}` } },
      ]],
    },
  });
}
