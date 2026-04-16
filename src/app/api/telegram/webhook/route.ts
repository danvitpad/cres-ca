/** --- YAML
 * name: Telegram Webhook
 * description: Handles incoming Telegram bot updates — /start, deep links, help, and VOICE messages (→ Gemini AI → actions)
 * updated: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { sendMessage } from '@/lib/telegram/bot';
import { createClient } from '@/lib/supabase/server';
import { parseVoiceIntent, downloadTelegramFile, type VoiceIntent } from '@/lib/ai/gemini-voice';

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from: { id: number; first_name: string; last_name?: string };
    text?: string;
    voice?: { file_id: string; duration: number };
    audio?: { file_id: string; duration: number };
  };
}

export async function POST(request: Request) {
  const update: TelegramUpdate = await request.json();

  if (!update.message) {
    return NextResponse.json({ ok: true });
  }

  const chatId = update.message.chat.id;
  const telegramId = update.message.from.id;
  const firstName = update.message.from.first_name;

  console.log('[webhook] from:', telegramId, firstName, 'chat:', chatId);

  // ── Voice message → Gemini AI ──
  const voiceFileId = update.message.voice?.file_id || update.message.audio?.file_id;
  if (voiceFileId) {
    await handleVoiceMessage(chatId, telegramId, voiceFileId);
    return NextResponse.json({ ok: true });
  }

  const text = update.message.text;
  if (!text) {
    return NextResponse.json({ ok: true });
  }

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
        `👋 Добро пожаловать в <b>CRES-CA</b>, ${firstName}!\n\nНайди лучших мастеров, записывайся в пару тапов и получай бонусы.\n\n🎤 <b>Отправь голосовое сообщение</b> — я пойму и создам напоминание, запись или заметку.\n\nОткрой приложение, чтобы начать:`,
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

  // /app
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
      '💡 <b>Команды CRES-CA:</b>\n\n/start — запуск\n/app — открыть приложение\n/help — справка\n\n🎤 <b>Голосовой ассистент:</b>\nОтправь голосовое — я создам напоминание, запишу клиента, добавлю расход или заметку.\n\nПримеры:\n• «Напомни завтра в 10 позвонить Марии»\n• «Запиши Анну на стрижку в пятницу в 14»\n• «Потратил 500 грн на краску»',
      { parse_mode: 'HTML' },
    );
    return NextResponse.json({ ok: true });
  }

  // Fallback — text messages can also be parsed as commands
  await sendMessage(chatId, '🎤 Отправь голосовое сообщение — я пойму и выполню.\n\nИли нажми /help для списка команд.', {
    reply_markup: {
      inline_keyboard: [[{ text: '✨ Открыть CRES-CA', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram` } }]],
    },
  });

  return NextResponse.json({ ok: true });
}

/* ─── Voice Message Handler ─── */

async function handleVoiceMessage(chatId: number, telegramId: number, fileId: string) {
  const supabase = await createClient();

  // Find master by telegram_id
  console.log('[voice] looking up telegram_id:', telegramId, typeof telegramId);
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_id', telegramId)
    .single();

  console.log('[voice] profile lookup result:', profile, 'error:', profileError);

  if (!profile) {
    await sendMessage(chatId, '❌ Аккаунт не привязан. Подключи Telegram в настройках CRES-CA.');
    return;
  }

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', profile.id)
    .single();

  if (!master) {
    await sendMessage(chatId, '❌ Голосовой ассистент доступен только мастерам.');
    return;
  }

  // Processing indicator
  await sendMessage(chatId, '🎧 Обрабатываю...');

  try {
    // Download voice → base64
    const { base64, mimeType } = await downloadTelegramFile(fileId);

    // Gemini: audio → structured intent
    const intent = await parseVoiceIntent(base64, mimeType);

    // Route action
    await routeVoiceAction(chatId, master.id, intent, supabase);
  } catch (err) {
    console.error('Voice processing error:', err);
    await sendMessage(chatId, '❌ Не удалось обработать голосовое. Попробуй ещё раз.');
  }
}

/* ─── Action Router ─── */

async function routeVoiceAction(
  chatId: number,
  masterId: string,
  intent: VoiceIntent,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  switch (intent.action) {
    case 'reminder': {
      const { error } = await supabase.from('reminders').insert({
        master_id: masterId,
        text: intent.text,
        due_at: intent.due_at,
        source: 'voice',
      });

      if (error) {
        await sendMessage(chatId, '❌ Не удалось сохранить напоминание.');
        return;
      }

      const timeStr = intent.due_at
        ? `⏰ ${new Date(intent.due_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
        : '📌 Без срока';

      await sendMessage(chatId, `✅ <b>Напоминание создано</b>\n\n${intent.text}\n${timeStr}`, {
        parse_mode: 'HTML',
      });
      break;
    }

    case 'expense': {
      if (intent.amount && intent.amount > 0) {
        const { error } = await supabase.from('expenses').insert({
          master_id: masterId,
          amount: intent.amount,
          date: new Date().toISOString().split('T')[0],
          description: intent.text,
          category: 'other',
        });

        if (error) {
          await sendMessage(chatId, '❌ Не удалось записать расход.');
          return;
        }

        await sendMessage(chatId, `✅ <b>Расход записан</b>\n\n${intent.text}\n💰 ${intent.amount} ₴`, {
          parse_mode: 'HTML',
        });
      } else {
        await sendMessage(chatId, `❓ Не удалось определить сумму. Скажи ещё раз с суммой.`);
      }
      break;
    }

    case 'client_note': {
      if (intent.client_name) {
        // Find client by name (fuzzy)
        const { data: clients } = await supabase
          .from('clients')
          .select('id, full_name')
          .eq('master_id', masterId)
          .ilike('full_name', `%${intent.client_name}%`)
          .limit(1);

        if (clients && clients.length > 0) {
          const client = clients[0];
          // Append to notes
          const { data: existing } = await supabase
            .from('clients')
            .select('notes')
            .eq('id', client.id)
            .single();

          const newNotes = existing?.notes
            ? `${existing.notes}\n[${new Date().toLocaleDateString('ru-RU')}] ${intent.text}`
            : `[${new Date().toLocaleDateString('ru-RU')}] ${intent.text}`;

          await supabase.from('clients').update({ notes: newNotes }).eq('id', client.id);

          await sendMessage(chatId, `✅ <b>Заметка добавлена</b>\n\n👤 ${client.full_name}\n📝 ${intent.text}`, {
            parse_mode: 'HTML',
          });
        } else {
          // Save as reminder instead
          await supabase.from('reminders').insert({
            master_id: masterId,
            text: `📝 ${intent.client_name}: ${intent.text}`,
            source: 'voice',
          });
          await sendMessage(chatId, `⚠️ Клиент «${intent.client_name}» не найден. Сохранил как напоминание.\n\n📝 ${intent.text}`, {
            parse_mode: 'HTML',
          });
        }
      } else {
        await sendMessage(chatId, `❓ Не понял имя клиента. Скажи: «У [имя] аллергия на...»`);
      }
      break;
    }

    case 'appointment': {
      // For appointments — save as reminder with context, full booking requires more data
      await supabase.from('reminders').insert({
        master_id: masterId,
        text: `📅 Записать: ${intent.client_name || '?'} — ${intent.service_name || intent.text}`,
        due_at: intent.due_at,
        source: 'voice',
      });

      let msg = `📅 <b>Запись на создание</b>\n\n`;
      if (intent.client_name) msg += `👤 ${intent.client_name}\n`;
      if (intent.service_name) msg += `💇 ${intent.service_name}\n`;
      if (intent.due_at) msg += `⏰ ${new Date(intent.due_at).toLocaleString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}\n`;
      msg += `\nСохранил как напоминание. Создай запись в календаре:`;

      await sendMessage(chatId, msg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '📅 Открыть календарь', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram/m/home` } }]],
        },
      });
      break;
    }

    case 'query': {
      // For queries — acknowledge and redirect to app
      await sendMessage(chatId, `📊 Открой дашборд для полной аналитики:\n\n💬 «${intent.raw_transcript}»`, {
        reply_markup: {
          inline_keyboard: [[{ text: '📊 Открыть дашборд', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram/m/home` } }]],
        },
      });
      break;
    }

    default: {
      // Unknown — save as reminder anyway
      if (intent.raw_transcript) {
        await supabase.from('reminders').insert({
          master_id: masterId,
          text: intent.raw_transcript,
          source: 'voice',
        });
        await sendMessage(chatId, `📌 Не понял точно что нужно, но сохранил как заметку:\n\n«${intent.raw_transcript}»`);
      } else {
        await sendMessage(chatId, '❌ Не удалось разобрать аудио. Попробуй ещё раз, говори чётче.');
      }
    }
  }
}

/* ─── Existing handlers (unchanged) ─── */

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
    .update({ telegram_id: telegramId })
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
    '✅ <b>Telegram подключён!</b>\n\nТеперь ты будешь получать уведомления о новых записях и отменах прямо сюда.\n\n🎤 Отправляй голосовые — я создам напоминания и заметки.',
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_id', telegramId)
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
