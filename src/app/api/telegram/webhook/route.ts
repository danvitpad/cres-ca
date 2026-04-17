/** --- YAML
 * name: Telegram Webhook
 * description: Handles incoming Telegram bot updates — /start, deep links, help, and VOICE messages (→ Gemini AI → actions)
 * updated: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/telegram/bot';
import { parseVoiceIntent, downloadTelegramFile, type VoiceIntent, type VoiceAction } from '@/lib/ai/gemini-voice';

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

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
  const supabase = createServiceClient();

  // Find CRES-CA account via telegram_sessions (chat_id → profile_id)
  const { data: session } = await supabase
    .from('telegram_sessions')
    .select('profile_id')
    .eq('chat_id', chatId)
    .single();

  if (!session) {
    await sendMessage(chatId, '❌ Сначала войди в CRES-CA через Mini App, чтобы использовать голосового ассистента.', {
      reply_markup: {
        inline_keyboard: [[{ text: '✨ Открыть CRES-CA', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram` } }]],
      },
    });
    return;
  }

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', session.profile_id)
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
  supabase: ReturnType<typeof createServiceClient>,
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
        ? `⏰ ${new Date(intent.due_at).toLocaleString('ru-RU', { timeZone: 'Europe/Kyiv', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
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

          // 1) Save to voice_notes (history with full context)
          await supabase.from('voice_notes').insert({
            master_id: masterId,
            client_id: client.id,
            raw_text: intent.raw_transcript || intent.text,
            parsed: { action: 'client_note', text: intent.text, source: 'telegram_voice' },
          });

          // 2) Append to clients.notes (quick inline preview)
          const { data: existing } = await supabase
            .from('clients')
            .select('notes')
            .eq('id', client.id)
            .single();

          const stamp = `[${new Date().toLocaleDateString('ru-RU')}]`;
          const newNotes = existing?.notes
            ? `${existing.notes}\n${stamp} ${intent.text}`
            : `${stamp} ${intent.text}`;

          await supabase.from('clients').update({ notes: newNotes }).eq('id', client.id);

          await sendMessage(chatId, `✅ <b>Заметка добавлена</b>\n\n👤 ${client.full_name}\n📝 ${intent.text}\n\n<i>Появится в карточке клиента.</i>`, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[{ text: '👤 Открыть клиента', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/clients/${client.id}` } }]],
            },
          });
        } else {
          // Save as reminder instead (clearly flagged)
          await supabase.from('reminders').insert({
            master_id: masterId,
            text: `📝 ${intent.client_name}: ${intent.text}`,
            source: 'voice',
          });
          await sendMessage(chatId, `⚠️ Клиент «${intent.client_name}» не найден. Сохранил как напоминание — добавь клиента в базу и перенесёшь.\n\n📝 ${intent.text}`, {
            parse_mode: 'HTML',
          });
        }
      } else {
        await sendMessage(chatId, `❓ Не понял имя клиента. Скажи: «У [имя] аллергия на...»`);
      }
      break;
    }

    case 'appointment': {
      // Try to actually create the appointment — match client + service, insert with end time = start + service.duration
      if (!intent.client_name || !intent.due_at) {
        // Not enough data — fall back to reminder
        await supabase.from('reminders').insert({
          master_id: masterId,
          text: `📅 Записать: ${intent.client_name || '?'} — ${intent.service_name || intent.text}`,
          due_at: intent.due_at,
          source: 'voice',
        });
        await sendMessage(chatId, `⚠️ Нужно больше деталей. Скажи: «Запиши [имя] на [услугу] в [время/дату]».\n\nПока сохранил как напоминание.`);
        break;
      }

      // Find client (fuzzy)
      const { data: clientsMatch } = await supabase
        .from('clients')
        .select('id, full_name, phone, profile_id')
        .eq('master_id', masterId)
        .ilike('full_name', `%${intent.client_name}%`)
        .limit(5);

      if (!clientsMatch || clientsMatch.length === 0) {
        await sendMessage(chatId, `⚠️ Клиент «${intent.client_name}» не найден в базе.\n\nДобавь клиента и повтори, или запиши через календарь.`, {
          reply_markup: {
            inline_keyboard: [[{ text: '📅 Открыть календарь', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram/m/home` } }]],
          },
        });
        break;
      }

      const client = clientsMatch[0]; // take first match

      // Find service (fuzzy if provided)
      let service: { id: string; name: string; duration_minutes: number; price: number } | null = null;
      if (intent.service_name) {
        const { data: servicesMatch } = await supabase
          .from('services')
          .select('id, name, duration_minutes, price')
          .eq('master_id', masterId)
          .ilike('name', `%${intent.service_name}%`)
          .limit(1);
        service = servicesMatch?.[0] || null;
      }

      const startsAt = new Date(intent.due_at);
      const duration = service?.duration_minutes ?? 60;
      const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);

      const { data: created, error: bookErr } = await supabase
        .from('appointments')
        .insert({
          master_id: masterId,
          client_id: client.id,
          service_id: service?.id || null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          status: 'confirmed',
          price: service?.price || 0,
        })
        .select('id')
        .single();

      if (bookErr) {
        await sendMessage(chatId, `❌ Не удалось создать запись: ${bookErr.message}`);
        break;
      }

      // Confirm to master
      const dateStr = startsAt.toLocaleString('ru-RU', { timeZone: 'Europe/Kyiv', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await sendMessage(chatId, `✅ <b>Запись создана</b>\n\n👤 ${client.full_name}\n💇 ${service?.name || '(без услуги)'}\n⏰ ${dateStr}\n\nКлиент получит уведомление.`, { parse_mode: 'HTML' });

      // Notify client (in-app + Telegram if linked)
      if (client.profile_id) {
        // In-app notification (channel=in_app)
        await supabase.from('notifications').insert({
          profile_id: client.profile_id,
          channel: 'in_app',
          title: 'Новая запись',
          body: `${service?.name || 'Услуга'} — ${dateStr}`,
          scheduled_for: new Date().toISOString(),
          status: 'pending',
          data: { appointment_id: created?.id, master_id: masterId, type: 'appointment_created' },
        });

        // Telegram: if client has telegram_id
        const { data: clientProfile } = await supabase
          .from('profiles')
          .select('telegram_id, full_name')
          .eq('id', client.profile_id)
          .single();

        if (clientProfile?.telegram_id) {
          const clientMsg = `📅 <b>Вам записали визит</b>\n\n💇 ${service?.name || 'Услуга'}\n⏰ ${dateStr}\n\nЕсли нужно отменить — напишите мастеру.`;
          // Send via Telegram Bot API directly
          try {
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: clientProfile.telegram_id,
                text: clientMsg,
                parse_mode: 'HTML',
              }),
            });
          } catch (e) {
            console.error('Failed to send client TG notification:', e);
          }
        }
      }
      break;
    }

    case 'inventory': {
      // Parse inventory deduction from free-text (e.g. "потратил 200 мл краски")
      // Reuse the regex parser from voice-action
      const text = intent.raw_transcript || intent.text;
      const unitPatterns = [
        { rx: /(\d+(?:[.,]\d+)?)\s*(?:мл|миллилитр\w*)\s+(\S+(?:\s+\S+)?)/i, unit: 'ml' },
        { rx: /(\d+(?:[.,]\d+)?)\s*(?:гр|г|грам\w*)\s+(\S+(?:\s+\S+)?)/i, unit: 'g' },
        { rx: /(\d+)\s*(?:шт|штук\w*)\s+(\S+(?:\s+\S+)?)/i, unit: 'pcs' },
      ];
      for (const p of unitPatterns) {
        const m = text.match(p.rx);
        if (!m) continue;
        const qty = parseFloat(m[1].replace(',', '.'));
        const itemHint = m[2].trim();
        const { data: items } = await supabase
          .from('inventory_items')
          .select('id, name, current_quantity, unit')
          .eq('master_id', masterId)
          .ilike('name', `%${itemHint}%`)
          .limit(1);
        if (items && items.length > 0) {
          const item = items[0];
          await supabase.from('inventory_items')
            .update({ current_quantity: Math.max(0, Number(item.current_quantity) - qty) })
            .eq('id', item.id);
          await sendMessage(chatId, `✅ <b>Списано ${qty} ${item.unit || p.unit} • ${item.name}</b>\nОсталось: ${Math.max(0, Number(item.current_quantity) - qty)}`, { parse_mode: 'HTML' });
          return;
        }
      }
      // Fall through — no match
      await sendMessage(chatId, `❓ Не нашёл такой материал в складе. Добавь его в /inventory и повтори.`);
      break;
    }

    case 'revenue': {
      // Master dictates today's clients/services/amounts
      const items = intent.items || [];
      let totalRevenue = intent.amount || 0;

      if (items.length > 0) {
        // Create completed appointments for each item
        for (const item of items) {
          await supabase.from('expenses').insert({
            master_id: masterId,
            amount: -(item.amount || 0), // negative = income
            date: new Date().toISOString().split('T')[0],
            description: `${item.service_name || 'Услуга'} — ${item.client_name || 'Клиент'}`,
            category: 'revenue_voice',
          });
        }

        let msg = `✅ <b>Выручка записана</b>\n\n`;
        for (const item of items) {
          msg += `👤 ${item.client_name || '—'} · ${item.service_name || '—'} · <b>${item.amount || 0} ₴</b>\n`;
        }
        msg += `\n💰 Итого: <b>${totalRevenue} ₴</b>`;

        await sendMessage(chatId, msg, { parse_mode: 'HTML' });
      } else if (totalRevenue > 0) {
        await supabase.from('expenses').insert({
          master_id: masterId,
          amount: -totalRevenue,
          date: new Date().toISOString().split('T')[0],
          description: intent.text,
          category: 'revenue_voice',
        });
        await sendMessage(chatId, `✅ <b>Выручка записана</b>\n\n${intent.text}\n💰 ${totalRevenue} ₴`, {
          parse_mode: 'HTML',
        });
      } else {
        await sendMessage(chatId, `❓ Не удалось определить суммы. Скажи ещё раз с суммами.`);
      }
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
  const supabase = createServiceClient();

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

  // Record telegram session
  await supabase.from('telegram_sessions').upsert({ chat_id: chatId, profile_id: tokenRow.profile_id, logged_in_at: new Date().toISOString() }, { onConflict: 'chat_id' });

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
  const supabase = createServiceClient();

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

  // Check if this chat has a logged-in CRES-CA session
  const { data: session } = await supabase
    .from('telegram_sessions')
    .select('profile_id')
    .eq('chat_id', chatId)
    .single();

  if (session) {
    await supabase.from('client_master_links').upsert({
      profile_id: session.profile_id,
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
