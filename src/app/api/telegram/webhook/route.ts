/** --- YAML
 * name: Telegram Webhook
 * description: Handles incoming Telegram bot updates — /start, deep links, help, and VOICE messages (→ Gemini AI → actions)
 * updated: 2026-04-16
 * --- */

import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/telegram/bot';
import { parseVoiceIntent, downloadTelegramFile, type VoiceIntent } from '@/lib/ai/gemini-voice';
import { notifySuperadmin } from '@/lib/notifications/superadmin-notify';

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Fuzzy client lookup that tolerates AI transcription typos.
 * Strategy:
 *   1) exact substring match on full phrase
 *   2) match on each token (split by spaces) — catches cases where AI mis-spells
 *      the last name ("Падалко" → "Подалка") but gets the first name right
 *   3) return up to `limit` results sorted by match quality (more tokens matched first)
 */
async function findClientsFuzzy(
  supabase: ReturnType<typeof createServiceClient>,
  masterId: string,
  name: string,
  limit = 5,
): Promise<Array<{ id: string; full_name: string | null; phone: string | null; profile_id: string | null }>> {
  const trimmed = name.trim();
  if (!trimmed) return [];

  // Pass 1: full phrase
  const { data: exact } = await supabase
    .from('clients')
    .select('id, full_name, phone, profile_id')
    .eq('master_id', masterId)
    .ilike('full_name', `%${trimmed}%`)
    .limit(limit);
  if (exact && exact.length > 0) return exact;

  // Pass 2: per-token OR (use tokens of length >= 3 to avoid "он"/"да" noise)
  const tokens = trimmed.split(/\s+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return [];

  const orClause = tokens.map((t) => `full_name.ilike.%${t}%`).join(',');
  const { data: tokenMatches } = await supabase
    .from('clients')
    .select('id, full_name, phone, profile_id')
    .eq('master_id', masterId)
    .or(orClause)
    .limit(limit * 3);

  if (!tokenMatches || tokenMatches.length === 0) return [];

  // Rank: number of tokens matched (case-insensitive)
  const lowerTokens = tokens.map((t) => t.toLowerCase());
  const ranked = tokenMatches
    .map((c) => {
      const lower = (c.full_name || '').toLowerCase();
      const hits = lowerTokens.filter((t) => lower.includes(t)).length;
      return { c, hits };
    })
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((r) => r.c);

  return ranked;
}

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from: { id: number; first_name: string; last_name?: string };
    text?: string;
    voice?: { file_id: string; duration: number };
    audio?: { file_id: string; duration: number };
    reply_to_message?: { message_id: number; text?: string };
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string };
    message: { chat: { id: number }; message_id: number };
    data: string;
  };
}

export async function POST(request: Request) {
  const update: TelegramUpdate = await request.json();

  // Handle inline button callbacks first
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return NextResponse.json({ ok: true });
  }

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

  // ── Beta request: пользователь ответил на запрос почты ──
  // Бот просил почту с тегом [beta_email]. Ловим ответ, сохраняем заявку,
  // уведомляем супер-админа.
  if (update.message.reply_to_message?.text?.includes('[beta_email]')) {
    await handleBetaEmailReply(chatId, telegramId, text, firstName);
    return NextResponse.json({ ok: true });
  }

  // ── Review comment via force_reply ──
  // The earlier callback (review:<apt_id>:<stars>) sent a force_reply prompt
  // tagged with [review:<apt_id>]. When the user replies, we attach the text
  // as the reviews.comment. Quick path before falling through to the rest.
  const reviewReplyMatch = update.message.reply_to_message?.text?.match(/\[review:([0-9a-f-]{36})\]/i);
  if (reviewReplyMatch) {
    const apptId = reviewReplyMatch[1];
    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from('profiles').select('id').eq('telegram_id', telegramId).single();
    if (profile) {
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('appointment_id', apptId)
        .eq('target_type', 'master')
        .eq('reviewer_id', profile.id)
        .maybeSingle();
      if (existing) {
        await supabase.from('reviews').update({ comment: text.slice(0, 2000) }).eq('id', existing.id);
        await sendMessage(chatId, '✅ Спасибо! Комментарий сохранён.');
      } else {
        await sendMessage(chatId, '⚠️ Сначала поставь оценку звёздочками — комментарий привязывается к ней.');
      }
    }
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
    } else if (param === 'beta') {
      // Deep-link с beta-closed страницы — сразу запускаем beta-flow
      await handleBetaRequestStart(chatId, telegramId, firstName);
    } else {
      await sendMessage(
        chatId,
        `Добро пожаловать в <b>CRES-CA</b>, ${firstName}.\n\nСервис сейчас в стадии бета-тестирования. Открой приложение, если ты уже бета-тестировщик. Если нет — напиши «Хочу попасть в бета» и я возьму твою заявку.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: 'Открыть CRES-CA', web_app: { url: appUrl } }]],
          },
        },
      );
    }

    return NextResponse.json({ ok: true });
  }

  // ── Beta keyword detection ──
  // Если пользователь написал что-то про «опробовать / попробовать / тестировать /
  // бета» и НЕ зарегистрирован — запускаем beta-flow.
  if (/(хочу|хочется|можно)\s.{0,20}?(опробов|попробов|потестир|тестир|посмотр).{0,20}?(сайт|сервис|продукт|систем|app|приложен)/i.test(text)
      || /^(бета|beta)\b/i.test(text)
      || /попасть\s.{0,10}?(в\s+)?бет/i.test(text)) {
    const supabase = createServiceClient();
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .maybeSingle();
    if (!existingProfile) {
      await handleBetaRequestStart(chatId, telegramId, firstName, text);
      return NextResponse.json({ ok: true });
    }
  }

  // /find [query] — AI concierge search for a master
  if (text.startsWith('/find') || /^(найди|найти|подскажи|ищу)\s/i.test(text)) {
    const q = text.replace(/^\/find\s*/i, '').replace(/^(найди|найти|подскажи|ищу)\s+/i, '').trim();
    await handleClientSearch(chatId, q);
    return NextResponse.json({ ok: true });
  }

  // /feedback [text] — save user feedback. If no text, ask for follow-up message.
  if (text.startsWith('/feedback')) {
    await handleTextFeedback(chatId, telegramId, text.replace(/^\/feedback\s*/, '').trim(), firstName);
    return NextResponse.json({ ok: true });
  }

  // ── Master slash-commands ──
  if (text.startsWith('/today') || text.startsWith('/tomorrow')) {
    await handleMasterDayList(chatId, telegramId, text.startsWith('/tomorrow') ? 'tomorrow' : 'today');
    return NextResponse.json({ ok: true });
  }
  if (text.startsWith('/clients')) {
    await handleMasterClientsCount(chatId, telegramId);
    return NextResponse.json({ ok: true });
  }
  if (text.startsWith('/finance') || text.startsWith('/earnings')) {
    await handleMasterFinance(chatId, telegramId);
    return NextResponse.json({ ok: true });
  }

  // /help
  if (text.startsWith('/help')) {
    await sendMessage(
      chatId,
      '💡 <b>Команды CRES-CA:</b>\n\n<b>Общие:</b>\n/start — запуск\n/find — найти мастера (AI)\n/feedback — оставить отзыв\n/help — справка\n\n<b>Для мастеров:</b>\n/today — записи на сегодня\n/tomorrow — записи на завтра\n/clients — сколько у меня клиентов\n/finance — заработок за неделю/месяц\n\n🎤 <b>Голос (мастер):</b>\nОтправь голосовое — я создам напоминание, запишу клиента, добавлю расход.\n\n💬 <b>Отзыв голосом (все):</b>\nЗапиши голосовое со словами «обратная связь» — я сохраню в feedback.',
      { parse_mode: 'HTML' },
    );
    return NextResponse.json({ ok: true });
  }

  // Fallback — text messages can also be parsed as commands
  await sendMessage(chatId, '🎤 Отправь голосовое сообщение — я пойму и выполню.\n\nИли нажми /help для списка команд.', {
    reply_markup: {
      inline_keyboard: [[{ text: '✨ CRES-CA', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram` } }]],
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
        inline_keyboard: [[{ text: '✨ CRES-CA', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram` } }]],
      },
    });
    return;
  }

  // Processing indicator
  await sendMessage(chatId, '🎧 Обрабатываю...');

  let base64 = '';
  let mimeType = 'audio/ogg';
  try {
    const dl = await downloadTelegramFile(fileId);
    base64 = dl.base64;
    mimeType = dl.mimeType;
  } catch (err) {
    console.error('[voice] download failed:', err);
    await sendMessage(chatId, '❌ Не удалось скачать голосовое из Telegram. Запиши заново.');
    return;
  }

  // Pre-load master record (needed both for feedback routing and AI intent path)
  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('profile_id', session.profile_id)
    .maybeSingle();

  // Voice feedback path — for clients voice is always feedback (they have no AI assistant).
  // For masters: explicit feedback keywords route to feedback, else master AI intent path.
  try {
    const { voiceToText } = await import('@/lib/ai/router');
    const { data: transcript } = await voiceToText({ audioBase64: base64, mimeType });
    const t = (transcript ?? '').trim();

    const isFeedback = isFeedbackTranscript(t);
    // Clients (no master record) → all voice is feedback by default if transcript non-empty
    if (isFeedback || (!master && t.length >= 4)) {
      if (t.length < 4) {
        await sendMessage(chatId, '❌ Не удалось распознать голосовое. Попробуй сказать чётче или напиши текстом командой /feedback');
        return;
      }
      await saveFeedbackAndNotify(session.profile_id, t, 'telegram_voice');
      await sendMessage(chatId, FEEDBACK_THANKS);
      return;
    }
  } catch (err) {
    console.warn('[voice] pre-transcription failed, falling back to intent path:', err);
  }

  // Not feedback → master-only AI intent path
  if (!master) {
    await sendMessage(chatId, '❌ Не удалось обработать голосовое. Если это отзыв — повтори голосом или напиши /feedback <текст>.');
    return;
  }

  try {
    // Gemini: audio → structured intent
    const intent = await parseVoiceIntent(base64, mimeType);

    // Route action
    await routeVoiceAction(chatId, master.id, intent, supabase);
  } catch (err) {
    const msg = (err as Error)?.message ?? '';
    console.error('Voice processing error:', err);
    let userMsg = '❌ Не удалось обработать голосовое. Попробуй ещё раз, говори чётче.';
    if (msg.includes('All Gemini') || msg.includes('Gemini unavailable')) {
      userMsg = '❌ AI-сервис временно перегружен. Попробуй через 10-20 секунд.';
    } else if (msg.includes('Gemini 4')) {
      userMsg = '❌ AI не смог разобрать аудио (формат или квота). Запиши заново более чётко.';
    } else if (msg.includes('Could not get Telegram file')) {
      userMsg = '❌ Не удалось скачать голосовое из Telegram. Запиши заново.';
    } else if (msg.includes('unparseable')) {
      userMsg = '❌ AI не понял что нужно сделать. Опиши конкретнее: "напомни", "запиши", "потратил", "добавь день рождения" и т.д.';
    }
    await sendMessage(chatId, userMsg);
  }
}

/* ─── Action Router ─── */

async function logAiAction(
  supabase: ReturnType<typeof createServiceClient>,
  masterId: string,
  params: {
    actionType: string;
    inputText: string;
    result?: Record<string, unknown>;
    status?: 'success' | 'needs_confirmation' | 'failed';
    errorMessage?: string;
    relatedClientId?: string | null;
    relatedAppointmentId?: string | null;
  },
) {
  try {
    await supabase.from('ai_actions_log').insert({
      master_id: masterId,
      source: 'voice',
      action_type: params.actionType,
      input_text: params.inputText,
      result: params.result ?? null,
      status: params.status ?? 'success',
      error_message: params.errorMessage ?? null,
      related_client_id: params.relatedClientId ?? null,
      related_appointment_id: params.relatedAppointmentId ?? null,
    });
  } catch (e) {
    console.error('[voice] failed to log ai_action:', (e as Error).message);
  }
}

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
        await logAiAction(supabase, masterId, { actionType: 'reminder_created', inputText: intent.raw_transcript || intent.text, status: 'failed', errorMessage: error.message });
        await sendMessage(chatId, '❌ Не удалось сохранить напоминание.');
        return;
      }

      const timeStr = intent.due_at
        ? `⏰ ${new Date(intent.due_at).toLocaleString('ru-RU', { timeZone: 'Europe/Kyiv', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
        : '📌 Без срока';

      await logAiAction(supabase, masterId, {
        actionType: 'reminder_created',
        inputText: intent.raw_transcript || intent.text,
        status: 'success',
        result: { text: intent.text, due_at: intent.due_at ?? null },
      });
      await sendMessage(chatId, `✅ <b>Напоминание создано</b>\n\n${intent.text}\n${timeStr}`, {
        parse_mode: 'HTML',
      });
      break;
    }

    case 'expense': {
      if (intent.amount && intent.amount > 0) {
        // Guess category from description text
        const descLower = (intent.text || '').toLowerCase();
        const category = (() => {
          if (/(аренд|помещен|кабинет|зал)/i.test(descLower)) return 'Аренда';
          if (/(еда|обед|кофе|ресторан|перекус|завтрак|ужин)/i.test(descLower)) return 'Еда';
          if (/(такси|транспорт|бензин|парков|метро|автобус)/i.test(descLower)) return 'Транспорт';
          if (/(свет|газ|вода|интернет|коммунал)/i.test(descLower)) return 'Коммунальные';
          if (/(реклам|таргет|инстаграм|маркетинг|продвижен)/i.test(descLower)) return 'Реклама';
          if (/(оборудован|инструмент|станок|машинк|фен|аппарат)/i.test(descLower)) return 'Оборудование';
          // Default — расходники (materials): гель, лак, краска, etc.
          return 'Расходники';
        })();

        const { error } = await supabase.from('expenses').insert({
          master_id: masterId,
          amount: intent.amount,
          date: new Date().toISOString().split('T')[0],
          description: intent.text,
          vendor: null,
          category,
        });

        if (error) {
          await logAiAction(supabase, masterId, { actionType: 'expense_created', inputText: intent.raw_transcript || intent.text, status: 'failed', errorMessage: error.message });
          await sendMessage(chatId, '❌ Не удалось записать расход.');
          return;
        }

        await logAiAction(supabase, masterId, {
          actionType: 'expense_created',
          inputText: intent.raw_transcript || intent.text,
          status: 'success',
          result: { amount: intent.amount, category, description: intent.text },
        });
        await sendMessage(chatId, `✅ <b>Расход записан</b>\n\n📦 ${intent.text}\n🏷️ ${category}\n💰 ${intent.amount} ₴`, {
          parse_mode: 'HTML',
        });
      } else {
        await logAiAction(supabase, masterId, { actionType: 'expense_created', inputText: intent.raw_transcript || intent.text, status: 'needs_confirmation', errorMessage: 'amount_not_detected' });
        await sendMessage(chatId, `❓ Не удалось определить сумму. Скажи ещё раз с суммой.`);
      }
      break;
    }

    case 'client_note': {
      if (intent.client_name) {
        // Find client by name (fuzzy — tolerates AI transcription typos).
        // Шаг 11: limit=5 to detect same-name ambiguity.
        const clients = await findClientsFuzzy(supabase, masterId, intent.client_name, 5);

        if (clients && clients.length > 1) {
          const list = clients.slice(0, 5).map((c, i) => {
            const name = c.full_name ?? '—';
            const phoneSuffix = c.phone ? ` (${c.phone.slice(-4)})` : '';
            return `${i + 1}. ${escapeHtml(name)}${phoneSuffix}`;
          }).join('\n');
          await logAiAction(supabase, masterId, {
            actionType: 'client_note',
            inputText: intent.raw_transcript || intent.text,
            status: 'needs_confirmation',
            errorMessage: 'multiple_clients_matched',
            result: { client_name: intent.client_name, candidates: clients.length },
          });
          await sendMessage(
            chatId,
            `🤔 Нашёл несколько клиентов с именем «${escapeHtml(intent.client_name)}»:\n\n${list}\n\nПовтори голосом с фамилией — например: «У Анны Ивановой ...»`,
            { parse_mode: 'HTML' },
          );
          break;
        }

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

          await logAiAction(supabase, masterId, {
            actionType: 'client_note',
            inputText: intent.raw_transcript || intent.text,
            status: 'success',
            result: { client_name: client.full_name, note: intent.text },
            relatedClientId: client.id,
          });
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
          await logAiAction(supabase, masterId, {
            actionType: 'client_note',
            inputText: intent.raw_transcript || intent.text,
            status: 'needs_confirmation',
            errorMessage: 'client_not_found',
            result: { client_name: intent.client_name, fallback: 'reminder' },
          });
          await sendMessage(chatId, `⚠️ Клиент «${intent.client_name}» не найден. Сохранил как напоминание — добавь клиента в базу и перенесёшь.\n\n📝 ${intent.text}`, {
            parse_mode: 'HTML',
          });
        }
      } else {
        await logAiAction(supabase, masterId, {
          actionType: 'client_note',
          inputText: intent.raw_transcript || intent.text,
          status: 'needs_confirmation',
          errorMessage: 'client_name_not_detected',
        });
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
        await logAiAction(supabase, masterId, {
          actionType: 'appointment_created',
          inputText: intent.raw_transcript || intent.text,
          status: 'needs_confirmation',
          errorMessage: !intent.client_name ? 'client_name_missing' : 'due_at_missing',
        });
        await sendMessage(chatId, `⚠️ Нужно больше деталей. Скажи: «Запиши [имя] на [услугу] в [время/дату]».\n\nПока сохранил как напоминание.`);
        break;
      }

      // Find client (fuzzy — tolerates AI transcription typos like Падалко→Подалка)
      const clientsMatch = await findClientsFuzzy(supabase, masterId, intent.client_name, 5);

      if (!clientsMatch || clientsMatch.length === 0) {
        await logAiAction(supabase, masterId, {
          actionType: 'appointment_created',
          inputText: intent.raw_transcript || intent.text,
          status: 'failed',
          errorMessage: 'client_not_found',
          result: { client_name: intent.client_name },
        });
        await sendMessage(chatId, `⚠️ Клиент «${intent.client_name}» не найден в базе.\n\nДобавь клиента и повтори, или запиши через календарь.`, {
          reply_markup: {
            inline_keyboard: [[{ text: '📅 Календарь', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram/m/home` } }]],
          },
        });
        break;
      }

      // Шаг 11: same-name disambiguation. If multiple clients matched, ask
      // master to be more specific instead of silently picking the first.
      if (clientsMatch.length > 1) {
        const list = clientsMatch.slice(0, 5).map((c, i) => {
          const name = c.full_name ?? '—';
          const phoneSuffix = c.phone ? ` (${c.phone.slice(-4)})` : '';
          return `${i + 1}. ${escapeHtml(name)}${phoneSuffix}`;
        }).join('\n');
        await logAiAction(supabase, masterId, {
          actionType: 'appointment_created',
          inputText: intent.raw_transcript || intent.text,
          status: 'needs_confirmation',
          errorMessage: 'multiple_clients_matched',
          result: { client_name: intent.client_name, candidates: clientsMatch.length },
        });
        await sendMessage(
          chatId,
          `🤔 Нашёл несколько клиентов с именем «${escapeHtml(intent.client_name)}»:\n\n${list}\n\nПовтори голосом с фамилией — например: «Запиши Анну Иванову...»`,
          { parse_mode: 'HTML' },
        );
        break;
      }

      const client = clientsMatch[0]; // single match

      // Find service (multi-pass fuzzy)
      let service: { id: string; name: string; duration_minutes: number; price: number } | null = null;
      if (intent.service_name) {
        // Strip common prepositions/articles
        const cleaned = intent.service_name
          .toLowerCase()
          .replace(/^(на |в |под |про |для )/i, '')
          .trim();

        // Pass 1: full phrase ilike
        let { data: servicesMatch } = await supabase
          .from('services')
          .select('id, name, duration_minutes, price')
          .eq('master_id', masterId)
          .ilike('name', `%${cleaned}%`)
          .limit(1);

        // Pass 2: first meaningful word (skip words <4 chars)
        if (!servicesMatch || servicesMatch.length === 0) {
          const words = cleaned.split(/\s+/).filter(w => w.length >= 4);
          for (const w of words) {
            const { data: r } = await supabase
              .from('services')
              .select('id, name, duration_minutes, price')
              .eq('master_id', masterId)
              .ilike('name', `%${w}%`)
              .limit(1);
            if (r && r.length > 0) { servicesMatch = r; break; }
          }
        }

        // Pass 3: STEM match — take first 4-5 chars of each spoken word and
        // match against first 4-5 chars of any word in each service name.
        // Handles "почухивание спины" ↔ "Почухать спинку" (different declensions).
        if (!servicesMatch || servicesMatch.length === 0) {
          const { data: allServices } = await supabase
            .from('services')
            .select('id, name, duration_minutes, price')
            .eq('master_id', masterId)
            .eq('is_active', true);
          if (allServices && allServices.length > 0) {
            const spokenStems = cleaned
              .toLowerCase()
              .split(/\s+/)
              .filter(w => w.length >= 4)
              .map(w => w.slice(0, Math.min(5, Math.max(4, w.length - 2)))); // "почухивание" → "почух"
            const ranked = allServices
              .map(svc => {
                const svcStems = (svc.name || '')
                  .toLowerCase()
                  .split(/\s+/)
                  .filter((w: string) => w.length >= 4)
                  .map((w: string) => w.slice(0, Math.min(5, Math.max(4, w.length - 2))));
                const hits = spokenStems.filter(s => svcStems.some((t: string) => t.startsWith(s) || s.startsWith(t))).length;
                return { svc, hits };
              })
              .filter(r => r.hits > 0)
              .sort((a, b) => b.hits - a.hits);
            if (ranked.length > 0) servicesMatch = [ranked[0].svc];
          }
        }

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
        await logAiAction(supabase, masterId, {
          actionType: 'appointment_created',
          inputText: intent.raw_transcript || intent.text,
          status: 'failed',
          errorMessage: bookErr.message,
          relatedClientId: client.id,
        });
        await sendMessage(chatId, `❌ Не удалось создать запись: ${bookErr.message}`);
        break;
      }

      await logAiAction(supabase, masterId, {
        actionType: 'appointment_created',
        inputText: intent.raw_transcript || intent.text,
        status: 'success',
        result: {
          client_name: client.full_name,
          service_name: service?.name || intent.service_name || null,
          starts_at: startsAt.toISOString(),
          price: service?.price || 0,
        },
        relatedClientId: client.id,
        relatedAppointmentId: created?.id ?? null,
      });

      // Confirm to master
      const dateStr = startsAt.toLocaleString('ru-RU', { timeZone: 'Europe/Kyiv', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const serviceLine = service
        ? `💇 ${service.name}`
        : intent.service_name
          ? `💇 ${intent.service_name} <i>(услуги нет в каталоге — добавь в /services)</i>`
          : `💇 <i>(услуга не указана)</i>`;
      await sendMessage(chatId, `✅ <b>Запись создана</b>\n\n👤 ${client.full_name}\n${serviceLine}\n⏰ ${dateStr}\n\nКлиент получит уведомление.`, { parse_mode: 'HTML' });

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
          const clientMsg = `📅 <b>Вам записали визит</b>\n\n💇 ${service?.name || intent.service_name || 'Услуга'}\n⏰ ${dateStr}`;
          try {
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: clientProfile.telegram_id,
                text: clientMsg,
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '❌ Отменить запись', callback_data: `cancel_appt:${created?.id}` }],
                  ],
                },
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
          const remaining = Math.max(0, Number(item.current_quantity) - qty);
          await supabase.from('inventory_items')
            .update({ current_quantity: remaining })
            .eq('id', item.id);
          await logAiAction(supabase, masterId, {
            actionType: 'inventory_deducted',
            inputText: intent.raw_transcript || intent.text,
            status: 'success',
            result: { item_name: item.name, qty, unit: item.unit || p.unit, remaining },
          });
          await sendMessage(chatId, `✅ <b>Списано ${qty} ${item.unit || p.unit} • ${item.name}</b>\nОсталось: ${remaining}`, { parse_mode: 'HTML' });
          return;
        }
      }
      // Fall through — no match
      await logAiAction(supabase, masterId, {
        actionType: 'inventory_deducted',
        inputText: intent.raw_transcript || intent.text,
        status: 'failed',
        errorMessage: 'item_not_found',
      });
      await sendMessage(chatId, `❓ Не нашёл такой материал в складе. Добавь его в /inventory и повтори.`);
      break;
    }

    case 'revenue': {
      // Master dictates today's clients/services/amounts
      const items = intent.items || [];
      const totalRevenue = intent.amount || 0;

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

        await logAiAction(supabase, masterId, {
          actionType: 'revenue_voice',
          inputText: intent.raw_transcript || intent.text,
          status: 'success',
          result: { items, total: totalRevenue },
        });
        await sendMessage(chatId, msg, { parse_mode: 'HTML' });
      } else if (totalRevenue > 0) {
        await supabase.from('expenses').insert({
          master_id: masterId,
          amount: -totalRevenue,
          date: new Date().toISOString().split('T')[0],
          description: intent.text,
          category: 'revenue_voice',
        });
        await logAiAction(supabase, masterId, {
          actionType: 'revenue_voice',
          inputText: intent.raw_transcript || intent.text,
          status: 'success',
          result: { total: totalRevenue, description: intent.text },
        });
        await sendMessage(chatId, `✅ <b>Выручка записана</b>\n\n${intent.text}\n💰 ${totalRevenue} ₴`, {
          parse_mode: 'HTML',
        });
      } else {
        await logAiAction(supabase, masterId, {
          actionType: 'revenue_voice',
          inputText: intent.raw_transcript || intent.text,
          status: 'needs_confirmation',
          errorMessage: 'amount_not_detected',
        });
        await sendMessage(chatId, `❓ Не удалось определить суммы. Скажи ещё раз с суммами.`);
      }
      break;
    }

    case 'cancel': {
      if (!intent.client_name) {
        await sendMessage(chatId, '⚠️ Скажи имя клиента: «Отмени Анну на завтра».');
        await logAiAction(supabase, masterId, { actionType: 'appointment_cancel', inputText: intent.raw_transcript, status: 'needs_confirmation' });
        break;
      }

      const clientsMatch = await findClientsFuzzy(supabase, masterId, intent.client_name, 3);

      if (!clientsMatch || clientsMatch.length === 0) {
        await sendMessage(chatId, `⚠️ Клиент «${intent.client_name}» не найден.`);
        await logAiAction(supabase, masterId, { actionType: 'appointment_cancel', inputText: intent.raw_transcript, status: 'failed', errorMessage: 'client_not_found' });
        break;
      }

      const client = clientsMatch[0];
      let query = supabase
        .from('appointments').select('id, starts_at, service_id, status').eq('master_id', masterId).eq('client_id', client.id)
        .in('status', ['booked', 'confirmed']);

      if (intent.due_at) {
        const day = new Date(intent.due_at);
        const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
        query = query.gte('starts_at', dayStart.toISOString()).lte('starts_at', dayEnd.toISOString());
      } else {
        query = query.gte('starts_at', new Date().toISOString());
      }

      const { data: appts } = await query.order('starts_at', { ascending: true }).limit(3);

      if (!appts || appts.length === 0) {
        await sendMessage(chatId, `⚠️ У ${client.full_name} нет активных записей${intent.due_at ? ' на эту дату' : ''}.`);
        await logAiAction(supabase, masterId, { actionType: 'appointment_cancel', inputText: intent.raw_transcript, status: 'failed', errorMessage: 'no_active_appointment', relatedClientId: client.id });
        break;
      }

      const appt = appts[0];
      const { error: cancelErr } = await supabase
        .from('appointments').update({ status: 'cancelled' }).eq('id', appt.id);

      if (cancelErr) {
        await sendMessage(chatId, `❌ Не удалось отменить запись: ${cancelErr.message}`);
        await logAiAction(supabase, masterId, { actionType: 'appointment_cancel', inputText: intent.raw_transcript, status: 'failed', errorMessage: cancelErr.message, relatedClientId: client.id, relatedAppointmentId: appt.id });
        break;
      }

      const dateStr = new Date(appt.starts_at).toLocaleString('ru-RU', { timeZone: 'Europe/Kyiv', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await sendMessage(chatId, `✅ <b>Запись отменена</b>\n\n👤 ${client.full_name}\n⏰ ${dateStr}`, { parse_mode: 'HTML' });
      await logAiAction(supabase, masterId, {
        actionType: 'appointment_cancel',
        inputText: intent.raw_transcript,
        result: { appointment_id: appt.id, client_id: client.id, previous_status: appt.status, new_status: 'cancelled' },
        relatedClientId: client.id,
        relatedAppointmentId: appt.id,
      });
      break;
    }

    case 'reschedule': {
      if (!intent.client_name || !intent.new_due_at) {
        await sendMessage(chatId, '⚠️ Скажи кого и на когда: «Перенеси Анну на пятницу на 15».');
        await logAiAction(supabase, masterId, { actionType: 'appointment_reschedule', inputText: intent.raw_transcript, status: 'needs_confirmation' });
        break;
      }

      const clientsMatch = await findClientsFuzzy(supabase, masterId, intent.client_name, 3);

      if (!clientsMatch || clientsMatch.length === 0) {
        await sendMessage(chatId, `⚠️ Клиент «${intent.client_name}» не найден.`);
        await logAiAction(supabase, masterId, { actionType: 'appointment_reschedule', inputText: intent.raw_transcript, status: 'failed', errorMessage: 'client_not_found' });
        break;
      }

      const client = clientsMatch[0];
      let query = supabase
        .from('appointments').select('id, starts_at, ends_at, service_id, status').eq('master_id', masterId).eq('client_id', client.id)
        .in('status', ['booked', 'confirmed']);

      if (intent.due_at) {
        const day = new Date(intent.due_at);
        const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
        query = query.gte('starts_at', dayStart.toISOString()).lte('starts_at', dayEnd.toISOString());
      } else {
        query = query.gte('starts_at', new Date().toISOString());
      }

      const { data: appts } = await query.order('starts_at', { ascending: true }).limit(3);

      if (!appts || appts.length === 0) {
        await sendMessage(chatId, `⚠️ У ${client.full_name} нет активных записей${intent.due_at ? ' на указанную дату' : ''}.`);
        await logAiAction(supabase, masterId, { actionType: 'appointment_reschedule', inputText: intent.raw_transcript, status: 'failed', errorMessage: 'no_active_appointment', relatedClientId: client.id });
        break;
      }

      const appt = appts[0];
      const oldStart = new Date(appt.starts_at);
      const oldEnd = new Date(appt.ends_at);
      const durationMs = oldEnd.getTime() - oldStart.getTime();
      const newStart = new Date(intent.new_due_at);
      const newEnd = new Date(newStart.getTime() + durationMs);

      const { error: rescheduleErr } = await supabase
        .from('appointments').update({ starts_at: newStart.toISOString(), ends_at: newEnd.toISOString() }).eq('id', appt.id);

      if (rescheduleErr) {
        await sendMessage(chatId, `❌ Не удалось перенести: ${rescheduleErr.message}`);
        await logAiAction(supabase, masterId, { actionType: 'appointment_reschedule', inputText: intent.raw_transcript, status: 'failed', errorMessage: rescheduleErr.message, relatedClientId: client.id, relatedAppointmentId: appt.id });
        break;
      }

      const fmt = (d: Date) => d.toLocaleString('ru-RU', { timeZone: 'Europe/Kyiv', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await sendMessage(chatId, `✅ <b>Запись перенесена</b>\n\n👤 ${client.full_name}\n⏰ ${fmt(oldStart)} → ${fmt(newStart)}`, { parse_mode: 'HTML' });
      await logAiAction(supabase, masterId, {
        actionType: 'appointment_reschedule',
        inputText: intent.raw_transcript,
        result: { appointment_id: appt.id, client_id: client.id, from: appt.starts_at, to: newStart.toISOString() },
        relatedClientId: client.id,
        relatedAppointmentId: appt.id,
      });
      break;
    }

    case 'create_client': {
      if (!intent.client_name) {
        await sendMessage(chatId, '⚠️ Скажи имя клиента: «Новая клиентка Марина, телефон 0671234567».');
        await logAiAction(supabase, masterId, { actionType: 'client_created', inputText: intent.raw_transcript, status: 'needs_confirmation' });
        break;
      }

      const { data: existing } = await supabase
        .from('clients').select('id, full_name').eq('master_id', masterId)
        .ilike('full_name', intent.client_name).limit(1);

      if (existing && existing.length > 0) {
        await sendMessage(chatId, `ℹ️ Клиент «${existing[0].full_name}» уже есть в базе.`);
        await logAiAction(supabase, masterId, { actionType: 'client_created', inputText: intent.raw_transcript, status: 'needs_confirmation', errorMessage: 'duplicate_name', relatedClientId: existing[0].id });
        break;
      }

      const { data: created, error: createErr } = await supabase
        .from('clients').insert({
          master_id: masterId,
          full_name: intent.client_name,
          phone: intent.phone || null,
          notes: intent.notes || null,
        }).select('id, full_name').single();

      if (createErr) {
        await sendMessage(chatId, `❌ Не удалось создать клиента: ${createErr.message}`);
        await logAiAction(supabase, masterId, { actionType: 'client_created', inputText: intent.raw_transcript, status: 'failed', errorMessage: createErr.message });
        break;
      }

      const phoneLine = intent.phone ? `\n📱 ${intent.phone}` : '';
      const notesLine = intent.notes ? `\n📝 ${intent.notes}` : '';
      await sendMessage(chatId, `✅ <b>Клиент добавлен</b>\n\n👤 ${created!.full_name}${phoneLine}${notesLine}`, { parse_mode: 'HTML' });
      await logAiAction(supabase, masterId, {
        actionType: 'client_created',
        inputText: intent.raw_transcript,
        result: { client_id: created!.id, full_name: created!.full_name, phone: intent.phone, notes: intent.notes },
        relatedClientId: created!.id,
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
      await logAiAction(supabase, masterId, { actionType: 'query', inputText: intent.raw_transcript, status: 'success' });
      break;
    }

    case 'client_update': {
      if (!intent.client_name) {
        await sendMessage(chatId, '❓ Скажи имя клиента: «добавь Таисии день рождения 5 марта 1998».');
        await logAiAction(supabase, masterId, { actionType: 'client_update', inputText: intent.raw_transcript, status: 'needs_confirmation', errorMessage: 'no_client_name' });
        break;
      }
      if (!intent.field || !intent.value) {
        await sendMessage(chatId, '❓ Не понял что именно обновить. Попробуй: «у Ани телефон 0671234567», «добавь Маше день рождения 12 мая 1990».');
        await logAiAction(supabase, masterId, { actionType: 'client_update', inputText: intent.raw_transcript, status: 'needs_confirmation', errorMessage: 'no_field_or_value' });
        break;
      }

      const clients = await findClientsFuzzy(supabase, masterId, intent.client_name, 1);
      if (!clients || clients.length === 0) {
        await sendMessage(chatId, `⚠️ Клиент «${intent.client_name}» не найден в базе.`);
        await logAiAction(supabase, masterId, { actionType: 'client_update', inputText: intent.raw_transcript, status: 'failed', errorMessage: 'client_not_found' });
        break;
      }
      const client = clients[0];

      // Map AI field → DB column + value shape
      const allowed: Record<string, (v: string) => Record<string, unknown> | null> = {
        date_of_birth: (v) => {
          // Accept YYYY-MM-DD or DD.MM.YYYY
          const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v
            : /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.test(v)
              ? v.replace(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/, (_, d, m, y) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
              : null;
          return iso ? { date_of_birth: iso } : null;
        },
        phone: (v) => ({ phone: v.replace(/\s+/g, '') }),
        email: (v) => ({ email: v.trim().toLowerCase() }),
        full_name: (v) => ({ full_name: v.trim() }),
        allergies: (v) => ({ allergies: v.split(/[,;]+/).map((s) => s.trim()).filter(Boolean) }),
        notes: (v) => ({ notes: v.trim() }),
      };
      const mapper = allowed[intent.field];
      if (!mapper) {
        await sendMessage(chatId, `❓ Поле «${intent.field}» нельзя обновить голосом.`);
        await logAiAction(supabase, masterId, { actionType: 'client_update', inputText: intent.raw_transcript, status: 'failed', errorMessage: `field_not_allowed:${intent.field}` });
        break;
      }
      const patch = mapper(intent.value);
      if (!patch) {
        await sendMessage(chatId, `❓ Не понял значение «${intent.value}». Для даты используй формат 5 марта 1998 или 05.03.1998.`);
        await logAiAction(supabase, masterId, { actionType: 'client_update', inputText: intent.raw_transcript, status: 'failed', errorMessage: 'invalid_value' });
        break;
      }

      const { error } = await supabase.from('clients').update(patch).eq('id', client.id);
      if (error) {
        await logAiAction(supabase, masterId, { actionType: 'client_update', inputText: intent.raw_transcript, status: 'failed', errorMessage: error.message, relatedClientId: client.id });
        await sendMessage(chatId, `❌ Не удалось обновить: ${error.message}`);
        break;
      }

      const fieldLabel: Record<string, string> = {
        date_of_birth: 'День рождения', phone: 'Телефон', email: 'Email',
        full_name: 'Имя', allergies: 'Аллергии', notes: 'Заметка',
      };
      await logAiAction(supabase, masterId, {
        actionType: 'client_update',
        inputText: intent.raw_transcript,
        status: 'success',
        result: { client_id: client.id, field: intent.field, value: intent.value },
        relatedClientId: client.id,
      });
      await sendMessage(chatId,
        `✅ <b>Обновлено</b>\n\n👤 ${client.full_name}\n${fieldLabel[intent.field] ?? intent.field}: ${intent.value}`,
        { parse_mode: 'HTML' },
      );
      break;
    }

    case 'expense_recurring': {
      if (!intent.amount || !intent.day_of_month) {
        await sendMessage(chatId, '❓ Скажи сумму и день месяца: «аренда 5000 каждое 1-е число».');
        await logAiAction(supabase, masterId, { actionType: 'expense_recurring', inputText: intent.raw_transcript, status: 'needs_confirmation' });
        break;
      }
      const dom = Math.min(28, Math.max(1, Math.round(intent.day_of_month)));
      const name = (intent.text || intent.category || 'Регулярный расход').slice(0, 80);
      const category = intent.category || 'Прочее';
      const { error } = await supabase.from('recurring_expenses').insert({
        master_id: masterId,
        name,
        amount: intent.amount,
        currency: 'UAH',
        category,
        day_of_month: dom,
        active: true,
      });
      if (error) {
        await logAiAction(supabase, masterId, { actionType: 'expense_recurring', inputText: intent.raw_transcript, status: 'failed', errorMessage: error.message });
        await sendMessage(chatId, `❌ Не удалось сохранить: ${error.message}`);
        break;
      }
      await logAiAction(supabase, masterId, {
        actionType: 'expense_recurring',
        inputText: intent.raw_transcript,
        status: 'success',
        result: { amount: intent.amount, day_of_month: dom, category },
      });
      await sendMessage(chatId,
        `✅ <b>Регулярный расход добавлен</b>\n\n💰 ${name} — ${intent.amount} ₴\n📅 Каждое ${dom}-е число\n🏷 ${category}\n\n<i>Запись появится автоматически в Финансах.</i>`,
        { parse_mode: 'HTML' },
      );
      break;
    }

    case 'supplier_order': {
      const supplierName = intent.supplier_name || intent.client_name;
      const items = Array.isArray(intent.items) ? intent.items : [];
      if (!supplierName || items.length === 0) {
        await sendMessage(chatId, '❓ Скажи: «Заказать у [имя поставщика] 5 кг краски, 3 щётки, на телеграм».');
        await logAiAction(supabase, masterId, { actionType: 'supplier_order', inputText: intent.raw_transcript, status: 'needs_confirmation' });
        break;
      }

      // Fuzzy-find supplier
      const tokens = supplierName.trim().split(/\s+/).filter((t: string) => t.length >= 3);
      const orClause = tokens.length > 0
        ? tokens.map((t: string) => `name.ilike.%${t}%`).join(',')
        : `name.ilike.%${supplierName}%`;
      const { data: suppliersMatch } = await supabase
        .from('suppliers')
        .select('id, name, email, telegram_id, phone')
        .eq('master_id', masterId)
        .or(orClause)
        .limit(3);

      if (!suppliersMatch || suppliersMatch.length === 0) {
        await sendMessage(chatId,
          `⚠️ Поставщик «${supplierName}» не найден.\n\nДобавь поставщика в каталог и повтори.`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: '📦 Открыть поставщиков', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/ru/suppliers` } }]],
            },
          },
        );
        await logAiAction(supabase, masterId, { actionType: 'supplier_order', inputText: intent.raw_transcript, status: 'failed', errorMessage: 'supplier_not_found' });
        break;
      }

      const supplier = suppliersMatch[0];
      const orderItems = items.map((it) => ({
        name: String(it.name ?? '').slice(0, 120) || 'Товар',
        quantity: Number(it.quantity ?? 1),
        unit: String(it.unit ?? 'шт').slice(0, 16),
      }));

      // items is a JSONB column on supplier_orders (no separate items table)
      const itemsJson = orderItems.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: 0,
        total: 0,
      }));

      const { data: order, error: ordErr } = await supabase
        .from('supplier_orders')
        .insert({
          master_id: masterId,
          supplier_id: supplier.id,
          currency: 'UAH',
          status: 'draft',
          items: itemsJson,
          total_cost: 0,
          note: intent.notes ?? null,
        })
        .select('id')
        .single();

      if (ordErr || !order) {
        await logAiAction(supabase, masterId, { actionType: 'supplier_order', inputText: intent.raw_transcript, status: 'failed', errorMessage: ordErr?.message ?? 'insert_failed' });
        await sendMessage(chatId, `❌ Не удалось создать заказ: ${ordErr?.message ?? 'unknown'}`);
        break;
      }

      // Summary for confirmation card
      const itemsText = orderItems.map((it) => `— ${it.name} × ${it.quantity} ${it.unit}`).join('\n');
      const channelHint = intent.channel === 'telegram'
        ? 'Телеграм предложен, готов отправить.'
        : intent.channel === 'email'
          ? 'Email предложен, готов отправить.'
          : 'Выбери канал доставки.';

      const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
      if (supplier.telegram_id) buttons.push([{ text: '📱 Telegram', callback_data: `so_tg:${order.id}` }]);
      if (supplier.email) buttons.push([{ text: '📧 Email', callback_data: `so_em:${order.id}` }]);
      buttons.push([{ text: '📄 Только PDF', callback_data: `so_pdf:${order.id}` }]);
      buttons.push([{ text: '❌ Отменить', callback_data: `so_cancel:${order.id}` }]);

      await sendMessage(chatId,
        `📦 <b>Заказ #${order.id.slice(0, 8)}</b>\n\n👤 ${supplier.name}\n\n${itemsText}\n\n${channelHint}`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
      );

      await logAiAction(supabase, masterId, {
        actionType: 'supplier_order',
        inputText: intent.raw_transcript,
        status: 'needs_confirmation',
        result: { order_id: order.id, supplier_id: supplier.id, items_count: orderItems.length },
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
        inline_keyboard: [[{ text: '📅 Календарь', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram/m/home` } }]],
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

/* ─── Inline button callbacks ─── */

async function handleCallbackQuery(cb: NonNullable<TelegramUpdate['callback_query']>) {
  const supabase = createServiceClient();
  const chatId = cb.message.chat.id;
  const telegramId = cb.from.id;
  const data = cb.data;

  // Acknowledge to remove loading spinner
  try {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cb.id }),
    });
  } catch {}

  // review:<apt_id>:<stars>  — native TG rating without a web round-trip
  if (data.startsWith('review:')) {
    const parts = data.split(':');
    const apptId = parts[1];
    const stars = Number(parts[2]);
    if (!apptId || !Number.isInteger(stars) || stars < 1 || stars > 5) {
      await sendMessage(chatId, '⚠️ Не удалось распознать оценку.');
      return;
    }
    const { data: profile } = await supabase
      .from('profiles').select('id').eq('telegram_id', telegramId).single();
    if (!profile) {
      await sendMessage(chatId, '⚠️ Профиль не найден. Войди через /start в приложение.');
      return;
    }
    const { data: appt } = await supabase
      .from('appointments')
      .select('id, master_id, client:clients!inner(profile_id)')
      .eq('id', apptId)
      .single();
    if (!appt) {
      await sendMessage(chatId, '⚠️ Запись не найдена.');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apptClient = appt.client as any;
    if (apptClient?.profile_id !== profile.id) {
      await sendMessage(chatId, '⚠️ Это не ваша запись — оставлять оценку нельзя.');
      return;
    }

    // Upsert by (appointment_id, target_type=master) so a re-tap updates score
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('appointment_id', apptId)
      .eq('target_type', 'master')
      .eq('reviewer_id', profile.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('reviews').update({
        score: stars,
      }).eq('id', existing.id);
    } else {
      await supabase.from('reviews').insert({
        appointment_id: apptId,
        target_type: 'master',
        target_id: appt.master_id,
        reviewer_id: profile.id,
        score: stars,
        is_published: true,
      });
    }

    // Replace the rating message with a thank-you and remove the keyboard
    try {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: cb.message.message_id,
          text: `<b>Спасибо за оценку!</b>\nВы поставили ${'⭐'.repeat(stars)}`,
          parse_mode: 'HTML',
        }),
      });
    } catch {}

    // Ask for an optional text comment via force_reply. The reply_to_message
    // marker «[review:<apt_id>]» is what the inbound-message handler keys off.
    await sendMessage(
      chatId,
      `Хочешь оставить комментарий? Просто ответь на это сообщение текстом.\n\n[review:${apptId}]`,
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reply_markup: { force_reply: true, selective: true } as any,
      },
    );
    return;
  }

  // cancel_appt:<uuid>
  if (data.startsWith('cancel_appt:')) {
    const apptId = data.split(':')[1];

    // Find profile by telegram_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();

    if (!profile) {
      await sendMessage(chatId, '⚠️ Профиль не найден. Войди через /start в приложение.');
      return;
    }

    // Find appointment, verify ownership (client matches this profile)
    const { data: appt } = await supabase
      .from('appointments')
      .select('id, status, starts_at, master_id, client:clients!inner(profile_id, full_name), service:services(name)')
      .eq('id', apptId)
      .single();

    if (!appt) {
      await sendMessage(chatId, '⚠️ Запись не найдена.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = appt.client as any;
    if (client?.profile_id !== profile.id) {
      await sendMessage(chatId, '⚠️ Это не ваша запись.');
      return;
    }

    if (appt.status === 'cancelled') {
      await sendMessage(chatId, 'Запись уже отменена.');
      return;
    }

    // Check cancellation policy
    const { data: masterRow } = await supabase
      .from('masters')
      .select('cancellation_policy, profile_id')
      .eq('id', appt.master_id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const policy: any = masterRow?.cancellation_policy || { free_hours: 24 };
    const hoursUntil = (new Date(appt.starts_at).getTime() - Date.now()) / (1000 * 60 * 60);
    const isFree = hoursUntil >= (policy.free_hours ?? 24);

    if (!isFree && policy.require_contact_master) {
      await sendMessage(chatId, `⚠️ <b>До визита меньше ${policy.free_hours ?? 24} ч</b>\n\nОтмена в этот срок требует связи с мастером. Напишите мастеру чтобы обсудить.`, {
        parse_mode: 'HTML',
      });
      return;
    }

    // Cancel
    await supabase.from('appointments').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: 'client',
    }).eq('id', apptId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceName = (appt.service as any)?.name || 'Услуга';
    const feeNote = isFree ? '\n\n✅ Без штрафа.' : '\n\n⚠️ Отмена в штрафной период — предоплата может не возвращаться. Свяжитесь с мастером.';
    await sendMessage(chatId, `✅ <b>Запись отменена</b>\n\n${serviceName}${feeNote}`, { parse_mode: 'HTML' });

    // Notify master
    const { data: masterProfile } = await supabase
      .from('profiles')
      .select('telegram_id')
      .eq('id', masterRow?.profile_id)
      .single();

    if (masterProfile?.telegram_id) {
      try {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: masterProfile.telegram_id,
            text: `❌ <b>Клиент отменил запись</b>\n\n👤 ${client?.full_name || '—'}\n💇 ${serviceName}\n⏰ ${new Date(appt.starts_at).toLocaleString('ru-RU', { timeZone: 'Europe/Kyiv', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
            parse_mode: 'HTML',
          }),
        });
      } catch {}
    }
    return;
  }

  // close_ok:<uuid> / close_no:<uuid> — master confirms appointment end
  if (data.startsWith('close_ok:') || data.startsWith('close_no:')) {
    const confirmed = data.startsWith('close_ok:');
    const apptId = data.split(':')[1];

    // Verify master authority via profile.telegram_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();
    if (!profile) {
      await sendMessage(chatId, '⚠️ Профиль не найден.');
      return;
    }
    const { data: masterRow } = await supabase
      .from('masters')
      .select('id')
      .eq('profile_id', profile.id)
      .single();
    if (!masterRow) {
      await sendMessage(chatId, '⚠️ Только мастер может подтвердить.');
      return;
    }

    const { data: appt } = await supabase
      .from('appointments')
      .select('id, master_id, status, price, client:clients(full_name), service:services(name)')
      .eq('id', apptId)
      .single();

    if (!appt || appt.master_id !== masterRow.id) {
      await sendMessage(chatId, '⚠️ Запись не найдена или не ваша.');
      return;
    }

    if (appt.status === 'completed' || appt.status === 'no_show' || appt.status === 'cancelled') {
      await sendMessage(chatId, 'Уже закрыта.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = (appt.service as any)?.name || 'Услуга';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cli = (appt.client as any)?.full_name || 'Клиент';
    const price = Number(appt.price) || 0;

    if (confirmed) {
      await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', apptId);
      await sendMessage(chatId, `✅ <b>Запись подтверждена</b>\n\n👤 ${cli}\n💇 ${svc}\n💰 ${price} ₴ зачислено в кассу.`, { parse_mode: 'HTML' });
    } else {
      await supabase
        .from('appointments')
        .update({ status: 'no_show' })
        .eq('id', apptId);
      await sendMessage(chatId, `❌ <b>Запись помечена как "не состоялась"</b>\n\n👤 ${cli}\n💇 ${svc}\n\nДеньги в кассу не зачислены.`, { parse_mode: 'HTML' });
    }
    return;
  }

  // Review stars — rv:<appointmentId>:<1-5>
  if (data.startsWith('rv:')) {
    const [, apptId, scoreStr] = data.split(':');
    const score = parseInt(scoreStr ?? '0', 10);
    if (score >= 1 && score <= 5) {
      await handleReviewStars(chatId, telegramId, apptId, score);
    }
    return;
  }

  // Rebook: client accepted a slot — rb_yes:<suggestionId>:<slotIdx>
  if (data.startsWith('rb_yes:')) {
    const [, suggestionId, slotIdxStr] = data.split(':');
    const slotIdx = parseInt(slotIdxStr ?? '0', 10);
    await handleRebookAccept(chatId, telegramId, suggestionId, slotIdx);
    return;
  }

  // Rebook: client declined — rb_no:<suggestionId>
  if (data.startsWith('rb_no:')) {
    const [, suggestionId] = data.split(':');
    await handleRebookDecline(chatId, telegramId, suggestionId);
    return;
  }

  // Supplier order channel pick: so_tg: / so_em: / so_pdf: / so_cancel:
  if (data.startsWith('so_')) {
    const [action, orderId] = data.split(':');
    if (!orderId) return;
    const channel =
      action === 'so_tg' ? 'telegram'
      : action === 'so_em' ? 'email'
      : action === 'so_pdf' ? 'pdf'
      : 'cancel';

    if (channel === 'cancel') {
      await supabase.from('supplier_orders').update({ status: 'cancelled' }).eq('id', orderId);
      await sendMessage(chatId, '❌ Заказ отменён.');
      return;
    }

    // Dispatch via the shared endpoint (keeps webhook lean, reuses PDF + send logic)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/supplier-orders/${orderId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, telegram_id: telegramId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        await sendMessage(chatId, `❌ ${json.error ?? 'Не удалось отправить'}`);
        return;
      }
      const channelLabel = channel === 'telegram' ? 'Telegram' : channel === 'email' ? 'Email' : 'PDF';
      await sendMessage(chatId, `✅ Заказ отправлен (${channelLabel}).`);
    } catch (err) {
      await sendMessage(chatId, `❌ Ошибка отправки: ${(err as Error).message}`);
    }
    return;
  }
}

/* ─── AI concierge: /find ─── */

async function handleClientSearch(chatId: number, query: string) {
  if (!query || query.length < 3) {
    await sendMessage(chatId,
      '🔍 <b>Найти мастера</b>\n\nНапиши что хочешь, например:\n<code>найди маникюр в центре Киева до 800 грн</code>\n<code>ищу парикмахера во Львове</code>\n<code>/find педикюр</code>',
      { parse_mode: 'HTML' });
    return;
  }

  await sendMessage(chatId, '🎯 Ищу подходящих мастеров…');

  try {
    const { parseClientConciergeText, isConciergeUsable } = await import('@/lib/ai/client-concierge');
    const { searchMasters } = await import('@/lib/marketplace/search');

    const intent = await parseClientConciergeText(query);
    if (!isConciergeUsable(intent)) {
      await sendMessage(chatId,
        '🤔 Не понял что искать. Попробуй указать услугу или город:\n<code>маникюр Киев</code>',
        { parse_mode: 'HTML' });
      return;
    }

    const results = await searchMasters({
      service: intent.service ?? undefined,
      city: intent.city ?? undefined,
      priceMax: intent.price_max ?? undefined,
      limit: 5,
    });

    if (results.length === 0) {
      const hints: string[] = [];
      if (intent.service) hints.push(`услуга: ${intent.service}`);
      if (intent.city) hints.push(`город: ${intent.city}`);
      if (intent.price_max) hints.push(`до ${intent.price_max} ₴`);
      await sendMessage(chatId,
        `😔 Не нашёл мастеров по фильтрам:\n${hints.join(' · ') || query}\n\nПопробуй изменить запрос или убрать фильтры.`);
      return;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

    // Header message with summary
    const title = intent.service ? intent.service[0].toUpperCase() + intent.service.slice(1) : 'Мастера';
    const cityLine = intent.city ? ` в ${intent.city}` : '';
    await sendMessage(chatId,
      `✨ <b>${title}${cityLine}</b>\n\nНашёл ${results.length} ${results.length === 1 ? 'мастера' : 'мастеров'} — от лучших рейтинг-wise:`,
      { parse_mode: 'HTML' });

    // Cards: one message per master with inline button to open profile
    for (const m of results) {
      const ratingStr = m.rating !== null ? `⭐ ${m.rating.toFixed(1)} (${m.reviewsCount})` : 'Новый';
      const topSvc = m.topServices[0];
      const priceStr = topSvc ? `\nот ${topSvc.price} ${topSvc.currency} · ${topSvc.name}` : '';
      const specLine = m.specialization ? `\n${m.specialization}` : '';
      const cityStr = m.city ? `\n📍 ${m.city}` : '';

      await sendMessage(chatId,
        `<b>${m.fullName}</b>${specLine}\n${ratingStr}${cityStr}${priceStr}`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '👉 Открыть профиль', url: `${appUrl}/m/${m.slug}` }]],
          },
        });
    }

    // Footer — link to full search
    const searchParams = new URLSearchParams();
    if (intent.service) searchParams.set('q', intent.service);
    if (intent.city) searchParams.set('city', intent.city);
    if (intent.price_max) searchParams.set('price_max', String(intent.price_max));
    await sendMessage(chatId, '👇 Ещё больше результатов', {
      reply_markup: {
        inline_keyboard: [[{ text: '🔎 Открыть поиск', url: `${appUrl}/ru/find?${searchParams.toString()}` }]],
      },
    });
  } catch (e) {
    console.error('[concierge] failed:', e);
    await sendMessage(chatId, '❌ AI-консьерж временно недоступен. Попробуй открыть приложение и искать вручную.');
  }
}

/* ─── Feedback via bot ─── */

const FEEDBACK_PROMPT = 'Запиши голосовое или напиши текстом — расскажи что улучшить, что сломалось, какая фича нужна. Твой отзыв прочитает команда CRES-CA лично.';

const FEEDBACK_THANKS = 'Команда CRES-CA благодарит вас за отзыв 💜\n\nМы стараемся сделать сервис максимально удобным и полезным. Ваш отзыв очень ценен для нас — мы прочитаем каждое сообщение лично!';

async function saveFeedbackAndNotify(profileId: string, transcript: string, source: 'telegram_bot' | 'telegram_voice') {
  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from('feedback')
    .insert({
      profile_id: profileId,
      source,
      original_text: transcript,
      cleaned_text: transcript,
    })
    .select('id')
    .single();

  // Notify founder DM + optional team channel
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', profileId)
    .maybeSingle();
  const profileName = profile?.full_name ?? 'User';
  const profileRole = profile?.role ?? null;

  const channelId = process.env.FEEDBACK_TG_CHANNEL_ID?.trim();
  const adminId = process.env.SUPERADMIN_TG_CHAT_ID?.trim();
  if (!channelId && !adminId) {
    console.warn('[feedback] No FEEDBACK_TG_CHANNEL_ID or SUPERADMIN_TG_CHAT_ID set — feedback saved to DB only');
    return;
  }

  const roleLine = profileRole ? ` (${escapeHtml(profileRole)})` : '';
  const icon = source === 'telegram_voice' ? '🎙' : '💬';
  const text =
    `${icon} <b>Новый feedback</b>\n` +
    `<b>От:</b> ${escapeHtml(profileName)}${roleLine}\n` +
    `<b>Источник:</b> ${source}\n` +
    (row?.id ? `<b>ID:</b> <code>${row.id}</code>\n\n` : '\n') +
    escapeHtml(transcript);

  const targets = new Set<string>();
  if (channelId) targets.add(channelId);
  if (adminId) targets.add(adminId);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('[feedback] TELEGRAM_BOT_TOKEN missing — cannot deliver');
    return;
  }

  await Promise.all(
    Array.from(targets).map(async (chat) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML' }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.error(`[feedback] Telegram sendMessage failed for chat=${chat} status=${res.status}: ${body}`);
        }
      } catch (e) {
        console.error(`[feedback] Telegram sendMessage threw for chat=${chat}:`, e);
      }
    }),
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function handleTextFeedback(chatId: number, telegramId: number, text: string, firstName: string) {
  const supabase = createServiceClient();
  const { data: session } = await supabase
    .from('telegram_sessions')
    .select('profile_id')
    .eq('chat_id', chatId)
    .maybeSingle();

  if (!session) {
    await sendMessage(chatId, `👋 ${firstName}, сначала войди в CRES-CA через Mini App, чтобы оставить отзыв.`, {
      reply_markup: {
        inline_keyboard: [[{ text: '✨ Открыть CRES-CA', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram` } }]],
      },
    });
    return;
  }

  if (!text) {
    await sendMessage(chatId, `💬 ${FEEDBACK_PROMPT}\n\nПример: <code>/feedback хотелось бы видеть напоминания за 2 часа</code>`, {
      parse_mode: 'HTML',
    });
    return;
  }

  if (text.length < 4) {
    await sendMessage(chatId, '❌ Слишком коротко. Напиши хотя бы пару фраз.');
    return;
  }

  await saveFeedbackAndNotify(session.profile_id, text, 'telegram_bot');
  await sendMessage(chatId, FEEDBACK_THANKS);
}

/** Returns true if this transcript should be treated as feedback rather than an AI intent command. */
function isFeedbackTranscript(transcript: string): boolean {
  const t = transcript.toLowerCase();
  return (
    t.includes('обратн')                                    // обратная связь / обратный отзыв
    || t.includes('фидбэк') || t.includes('фидбек') || t.includes('feedback')
    || t.includes('отзыв')                                  // отзыв / отзывы / отзыва
    || t.includes('пожелан')                                // пожелание / пожелания
    || t.includes('предложен')                              // предложение
    || t.includes('жалоб')                                  // жалоба
    || /^(привет|здравств).{0,40}(хочу|хотел|хотіл).{0,30}(сказать|поделить|сообщ|оставить)/i.test(t)
  );
}

/* ─── Review stars ─── */

async function handleReviewStars(chatId: number, telegramId: number, apptId: string, score: number) {
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (!profile) return;

  const { data: appt } = await supabase
    .from('appointments')
    .select('id, client_id, master_id, status, ends_at, review_submitted_at, ' +
      'clients:client_id!appointments_client_id_fkey(profile_id)')
    .eq('id', apptId)
    .maybeSingle();

  type Loaded = {
    id: string;
    client_id: string;
    master_id: string;
    status: string;
    ends_at: string;
    review_submitted_at: string | null;
    clients: { profile_id: string | null } | null;
  };
  const row = appt as unknown as Loaded | null;
  if (!row) return;
  if (row.clients?.profile_id !== profile.id) return;
  if (row.status !== 'completed') return;
  if (row.review_submitted_at) {
    await sendMessage(chatId, '⚠️ Ты уже оставил оценку для этого визита.');
    return;
  }

  // Insert review — trigger enforces all authenticity rules.
  // Prod schema is polymorphic: reviewer_id + target_id + target_type.
  const { error } = await supabase.from('reviews').insert({
    appointment_id: row.id,
    target_type: 'master',
    target_id: row.master_id,
    reviewer_id: profile.id,
    score,
    is_published: true,
  });

  if (error) {
    console.error('[review-stars] insert failed:', error.message);
    await sendMessage(chatId, `❌ ${error.message}`);
    return;
  }

  await supabase
    .from('appointments')
    .update({ review_submitted_at: new Date().toISOString() })
    .eq('id', row.id);

  const thanks = score >= 4
    ? `💜 Спасибо за ${score} ${score === 5 ? 'звёзд' : 'звезды'}! Если хочешь — напиши пару слов комментария ответом на это сообщение, мастер увидит.`
    : `Спасибо за оценку. Если было что-то не так — напиши ответом, я передам мастеру чтобы исправил.`;
  await sendMessage(chatId, thanks);
}

/* ─── Rebook client responses ─── */

async function handleRebookAccept(chatId: number, telegramId: number, suggestionId: string, slotIdx: number) {
  const supabase = createServiceClient();

  // Resolve client profile + suggestion
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (!profile) {
    await sendMessage(chatId, '❌ Не удалось определить твой аккаунт. Открой приложение заново.');
    return;
  }

  const { data: s } = await supabase
    .from('rebook_suggestions')
    .select('id, master_id, client_id, service_id, suggested_starts_at, suggested_duration_min, alt_slots, status, ' +
      'services:service_id!rebook_suggestions_service_id_fkey(name, price, currency), ' +
      'clients:client_id!rebook_suggestions_client_id_fkey(profile_id, full_name), ' +
      'masters:master_id!rebook_suggestions_master_id_fkey(profiles:profile_id(telegram_id))')
    .eq('id', suggestionId)
    .maybeSingle();

  type Loaded = {
    id: string;
    master_id: string;
    client_id: string;
    service_id: string | null;
    suggested_starts_at: string;
    suggested_duration_min: number;
    alt_slots: Array<{ starts_at: string }>;
    status: string;
    services: { name: string; price: number; currency: string } | null;
    clients: { profile_id: string | null; full_name: string } | null;
    masters: { profiles: { telegram_id: number | null } | null } | null;
  };
  const row = s as unknown as Loaded | null;
  if (!row) {
    await sendMessage(chatId, '❌ Предложение не найдено.');
    return;
  }
  if (row.status !== 'sent_client') {
    await sendMessage(chatId, '⚠️ Это предложение уже неактивно.');
    return;
  }
  if (row.clients?.profile_id && row.clients.profile_id !== profile.id) {
    await sendMessage(chatId, '❌ Это предложение не для тебя.');
    return;
  }

  const allSlots = [{ starts_at: row.suggested_starts_at }, ...(row.alt_slots ?? [])];
  const chosen = allSlots[slotIdx];
  if (!chosen) {
    await sendMessage(chatId, '❌ Слот не найден.');
    return;
  }

  // Re-check slot freshness — someone might have booked in meantime
  const { data: isFree } = await supabase.rpc('is_slot_free', {
    p_master_id: row.master_id,
    p_starts_at: chosen.starts_at,
    p_duration_min: row.suggested_duration_min,
  });
  if (isFree !== true) {
    await supabase.from('rebook_suggestions').update({ status: 'stale' }).eq('id', row.id);
    await sendMessage(chatId, '😔 Этот слот только что заняли. Напиши мастеру напрямую — подберём другое время.');
    return;
  }

  if (!row.service_id) {
    await sendMessage(chatId, '❌ Услуга в предложении пропала. Свяжись с мастером.');
    return;
  }

  const startsAt = new Date(chosen.starts_at);
  const endsAt = new Date(startsAt.getTime() + row.suggested_duration_min * 60 * 1000);

  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .insert({
      client_id: row.client_id,
      master_id: row.master_id,
      service_id: row.service_id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'booked',
      price: row.services?.price ?? 0,
      currency: row.services?.currency ?? 'UAH',
      booked_via: 'telegram',
      notes: 'Авто-запись через AI-рекомендацию',
    })
    .select('id')
    .single();

  if (apptErr || !appt) {
    console.error('[rebook-accept] appointment insert failed:', apptErr);
    await sendMessage(chatId, '❌ Не удалось создать запись. Попробуй позже.');
    return;
  }

  await supabase
    .from('rebook_suggestions')
    .update({
      status: 'accepted',
      client_responded_at: new Date().toISOString(),
      appointment_id: appt.id,
    })
    .eq('id', row.id);

  // Notify client + master
  const DOW = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const dateStr = `${DOW[startsAt.getDay()]}, ${startsAt.getDate()} ${startsAt.toLocaleDateString('ru-RU', { month: 'long' })}`;
  const timeStr = startsAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  await sendMessage(chatId, `✅ <b>Записал!</b>\n\n${dateStr} · ${timeStr}\n${row.services?.name ?? ''}\n\nДо встречи 💜`, { parse_mode: 'HTML' });

  const masterTg = row.masters?.profiles?.telegram_id;
  if (masterTg) {
    await sendMessage(masterTg, `✅ <b>${row.clients?.full_name ?? 'Клиент'}</b> вернулся через авто-запись!\n\n${dateStr} · ${timeStr}\n${row.services?.name ?? ''}`, { parse_mode: 'HTML' });
  }
}

async function handleRebookDecline(chatId: number, telegramId: number, suggestionId: string) {
  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (!profile) return;

  const { data: s } = await supabase
    .from('rebook_suggestions')
    .select('id, client_id, status, clients:client_id!rebook_suggestions_client_id_fkey(profile_id)')
    .eq('id', suggestionId)
    .maybeSingle();

  type Loaded = { id: string; client_id: string; status: string; clients: { profile_id: string | null } | null };
  const row = s as unknown as Loaded | null;
  if (!row || row.status !== 'sent_client') return;
  if (row.clients?.profile_id && row.clients.profile_id !== profile.id) return;

  await supabase
    .from('rebook_suggestions')
    .update({ status: 'declined', client_responded_at: new Date().toISOString() })
    .eq('id', row.id);

  await sendMessage(chatId, '👌 Хорошо, напишу позже. Если захочешь записаться сама — просто открой приложение.');
}

// ──────────────────────────────────────────────────────────────────────
// Beta gate handlers
// ──────────────────────────────────────────────────────────────────────

/**
 * Запускает flow заявки в бета. Сначала проверяет, нет ли уже заявки
 * от этого telegram_id, и в каком она статусе:
 *   - approved (ещё не зарегистрировался) → «вы уже одобрены, регистрируйтесь»
 *   - used (зарегистрирован) → «вы уже зарегистрированы»
 *   - pending → «вы уже подали, ждём одобрения»
 *   - rejected → «к сожалению, заявка отклонена»
 *   - нет заявки → создаёт pending + просит почту с force_reply
 */
async function handleBetaRequestStart(
  chatId: number,
  telegramId: number,
  firstName: string,
  rawText?: string,
): Promise<void> {
  const supabase = createServiceClient();

  // 1. Проверяем существующую заявку
  const { data: existing } = await supabase
    .from('beta_invites')
    .select('id, status, email, rejection_reason')
    .eq('telegram_id', telegramId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'approved') {
      await sendMessage(
        chatId,
        `${firstName}, вы уже одобрены — можно регистрироваться.\n\n` +
        `Откройте <a href="https://cres-ca.com">cres-ca.com</a> и пройдите регистрацию по почте <b>${existing.email ?? '—'}</b>.`,
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: 'Открыть сайт', url: 'https://cres-ca.com' }]] },
        },
      );
      return;
    }
    if (existing.status === 'used') {
      await sendMessage(
        chatId,
        `${firstName}, вы уже зарегистрированы в CRES-CA. Открывайте приложение и пользуйтесь.`,
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: 'Открыть сайт', url: 'https://cres-ca.com' }]] },
        },
      );
      return;
    }
    if (existing.status === 'pending') {
      await sendMessage(
        chatId,
        `${firstName}, ваша заявка уже у нас. Мы её рассматриваем — обычно отвечаем в течение суток. Когда одобрим, я напишу сюда же.`,
        { parse_mode: 'HTML' },
      );
      return;
    }
    if (existing.status === 'rejected') {
      const reason = existing.rejection_reason ? `\n\nПричина: ${existing.rejection_reason}` : '';
      await sendMessage(
        chatId,
        `${firstName}, к сожалению, ваша заявка не одобрена.${reason}\n\n` +
        `Вы сможете зарегистрироваться после публичного релиза.`,
        { parse_mode: 'HTML' },
      );
      return;
    }
  }

  // 2. Заявки нет — создаём pending без email и просим почту
  await supabase.rpc('create_beta_request', {
    p_telegram_id: telegramId,
    p_email: null,
    p_full_name: firstName,
    p_request_text: rawText ?? null,
  });

  await sendMessage(
    chatId,
    `Привет, ${firstName}.\n\n` +
    `Сервис CRES-CA сейчас в закрытом бета-тестировании. Чтобы добавить вас в список — пришлите в ответ на это сообщение свою <b>почту</b>.\n\n` +
    `Когда мы вас одобрим, я напишу тут же. На время бета и ещё 6 месяцев после релиза — <b>полный функционал бесплатно</b>.\n\n` +
    `<i>[beta_email]</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: { force_reply: true, input_field_placeholder: 'your@email.com' },
    },
  );
}

/**
 * Обрабатывает ответ пользователя с почтой. Сохраняет в beta_invites,
 * шлёт уведомление Данилу в @crescasuperadmin_bot, благодарит юзера.
 */
async function handleBetaEmailReply(
  chatId: number,
  telegramId: number,
  text: string,
  firstName: string,
): Promise<void> {
  const email = text.trim().toLowerCase();
  // Простая email валидация
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    await sendMessage(chatId, 'Это не похоже на почту. Пришли в формате <b>name@domain.com</b>.', {
      parse_mode: 'HTML',
      reply_markup: { force_reply: true, input_field_placeholder: 'your@email.com' },
    });
    // Подмешиваем тег обратно — чтобы следующий ответ снова поймать
    await sendMessage(chatId, '<i>[beta_email]</i>', { parse_mode: 'HTML' });
    return;
  }

  const supabase = createServiceClient();

  // Проверяем — может уже есть заявка с другим статусом
  const { data: existing } = await supabase
    .from('beta_invites')
    .select('id, status, email, rejection_reason')
    .eq('telegram_id', telegramId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && existing.status === 'approved') {
    await sendMessage(
      chatId,
      `${firstName}, вы уже одобрены раньше — можно регистрироваться. Открывайте <a href="https://cres-ca.com">cres-ca.com</a>.`,
      { parse_mode: 'HTML' },
    );
    return;
  }
  if (existing && existing.status === 'used') {
    await sendMessage(
      chatId,
      `${firstName}, вы уже зарегистрированы. Открывайте приложение.`,
      { parse_mode: 'HTML' },
    );
    return;
  }
  if (existing && existing.status === 'rejected') {
    const reason = existing.rejection_reason ? `\n\nПричина: ${existing.rejection_reason}` : '';
    await sendMessage(
      chatId,
      `${firstName}, ваша предыдущая заявка не была одобрена.${reason}\n\nСможете зарегистрироваться после публичного релиза.`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  // Если уже была pending заявка с тем же email — не создаём дубль и не плодим уведомление Данилу
  if (existing && existing.status === 'pending' && existing.email?.toLowerCase() === email) {
    await sendMessage(
      chatId,
      `${firstName}, ваша заявка уже у нас. Мы её рассматриваем.`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  // Создаём (или обновляем pending заявку с новой почтой)
  const { data: id } = await supabase.rpc('create_beta_request', {
    p_telegram_id: telegramId,
    p_email: email,
    p_full_name: firstName,
    p_request_text: null,
  });

  await sendMessage(
    chatId,
    `Спасибо, ${firstName}. Заявка принята — мы пришлём сообщение, когда одобрим.\n\n` +
    `Обычно отвечаем в течение суток.`,
    { parse_mode: 'HTML' },
  );

  // Уведомление Данилу в @crescasuperadmin_bot — только при первичной заявке,
  // не при обновлении email в уже существующей pending
  if (!existing) {
    await notifySuperadmin(
      `<b>Новая заявка на бета</b>\n\n` +
      `<b>Имя:</b> ${firstName}\n` +
      `<b>Email:</b> ${email}\n` +
      `<b>Telegram ID:</b> <code>${telegramId}</code>\n` +
      `<b>Заявка ID:</b> <code>${id ?? '—'}</code>`,
      {
        parseMode: 'HTML',
        buttons: [
          [{ text: 'Открыть в админке', url: `${process.env.NEXT_PUBLIC_APP_URL}/ru/superadmin/beta` }],
        ],
      },
    );
  }
}

/* ─── Master slash-commands ─── */

async function resolveMaster(telegramId: number): Promise<{ id: string; profileId: string } | null> {
  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('telegram_id', telegramId).maybeSingle();
  if (!profile) return null;
  const { data: master } = await supabase
    .from('masters').select('id').eq('profile_id', profile.id).maybeSingle();
  if (!master) return null;
  return { id: master.id as string, profileId: profile.id as string };
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const tz = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
  return `${tz.getHours().toString().padStart(2, '0')}:${tz.getMinutes().toString().padStart(2, '0')}`;
}

async function handleMasterDayList(chatId: number, telegramId: number, day: 'today' | 'tomorrow') {
  const m = await resolveMaster(telegramId);
  if (!m) {
    await sendMessage(chatId, '⚠️ Эта команда доступна только мастерам. Открой /telegram чтобы стать мастером.');
    return;
  }

  // Compute Kyiv day boundaries
  const offsetMs = day === 'tomorrow' ? 86400000 : 0;
  const now = new Date(Date.now() + offsetMs);
  const kyivDate = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' }); // YYYY-MM-DD
  const startISO = `${kyivDate}T00:00:00+02:00`;
  const endISO = `${kyivDate}T23:59:59+02:00`;

  const supabase = createServiceClient();
  const { data: appts } = await supabase
    .from('appointments')
    .select('id, starts_at, status, client:clients(full_name, phone), service:services(name, price, currency)')
    .eq('master_id', m.id)
    .gte('starts_at', startISO)
    .lte('starts_at', endISO)
    .neq('status', 'cancelled')
    .neq('status', 'cancelled_by_client')
    .order('starts_at');

  const dayLabel = day === 'today' ? 'Сегодня' : 'Завтра';
  if (!appts || appts.length === 0) {
    await sendMessage(chatId, `📅 <b>${dayLabel}</b> — записей нет.`, { parse_mode: 'HTML' });
    return;
  }

  type Row = { id: string; starts_at: string; status: string;
    client: { full_name: string | null; phone: string | null } | { full_name: string | null; phone: string | null }[] | null;
    service: { name: string | null; price: number | null; currency: string | null } | { name: string | null; price: number | null; currency: string | null }[] | null;
  };
  const lines = (appts as Row[]).map((a, i) => {
    const cli = Array.isArray(a.client) ? a.client[0] : a.client;
    const srv = Array.isArray(a.service) ? a.service[0] : a.service;
    const time = fmtTime(a.starts_at);
    const name = cli?.full_name ?? '—';
    const sname = srv?.name ?? '—';
    return `${i + 1}. <b>${time}</b> — ${escapeHtml(name)} (${escapeHtml(sname)})`;
  });

  await sendMessage(
    chatId,
    `📅 <b>${dayLabel}</b> · ${appts.length} ${appts.length === 1 ? 'запись' : appts.length < 5 ? 'записи' : 'записей'}\n\n${lines.join('\n')}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть календарь', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram/m/calendar` } }]],
      },
    },
  );
}

async function handleMasterClientsCount(chatId: number, telegramId: number) {
  const m = await resolveMaster(telegramId);
  if (!m) {
    await sendMessage(chatId, '⚠️ Эта команда доступна только мастерам.');
    return;
  }
  const supabase = createServiceClient();
  const { count: total } = await supabase
    .from('clients').select('id', { count: 'exact', head: true })
    .eq('master_id', m.id).is('deleted_at', null);

  // Активные за 90 дней — через completed appointments
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data: activeIds } = await supabase
    .from('appointments').select('client_id')
    .eq('master_id', m.id).eq('status', 'completed').gte('starts_at', since);
  const activeUnique = new Set((activeIds ?? []).map((r: { client_id: string }) => r.client_id)).size;

  await sendMessage(
    chatId,
    `👥 <b>Клиенты</b>\n\nВсего в базе: <b>${total ?? 0}</b>\nАктивных за 90 дней: <b>${activeUnique}</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть клиентов', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram/m/clients` } }]],
      },
    },
  );
}

async function handleMasterFinance(chatId: number, telegramId: number) {
  const m = await resolveMaster(telegramId);
  if (!m) {
    await sendMessage(chatId, '⚠️ Эта команда доступна только мастерам.');
    return;
  }
  const supabase = createServiceClient();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [weekRes, monthRes] = await Promise.all([
    supabase.from('appointments').select('price')
      .eq('master_id', m.id).eq('status', 'completed')
      .gte('starts_at', weekStart.toISOString()),
    supabase.from('appointments').select('price')
      .eq('master_id', m.id).eq('status', 'completed')
      .gte('starts_at', monthStart.toISOString()),
  ]);

  const sum = (rows: { price: number | null }[] | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.price ?? 0), 0);
  const week = sum(weekRes.data as { price: number | null }[]);
  const month = sum(monthRes.data as { price: number | null }[]);

  await sendMessage(
    chatId,
    `💰 <b>Заработок</b>\n\nЗа неделю: <b>${Math.round(week)} ₴</b>\nС начала месяца: <b>${Math.round(month)} ₴</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть финансы', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}/telegram/m/stats` } }]],
      },
    },
  );
}
