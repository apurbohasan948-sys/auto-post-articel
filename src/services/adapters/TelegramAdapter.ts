/**
 * Tara - Telegram Platform Adapter
 * Interacts with Telegram Bot API.
 * Real test via getMe and getChat.
 * Real post distribution via sendMessage.
 */

import { SocialIntegration, IntegrationTestResult, PublishingResult } from '../../types/integrations';
import { proxyFetch } from '../apiClient';

export interface TelegramPostPayload {
  title: string;
  summary: string;
  url?: string;
  tags?: string[];
}

export class TelegramAdapter {
  private static getBotToken(integration: SocialIntegration): string {
    return (
      integration.apiKey ||
      integration.accessToken ||
      integration.credentials?.botToken ||
      ''
    ).trim();
  }

  private static getChatId(integration: SocialIntegration): string {
    return (
      integration.channelId ||
      integration.accountId ||
      integration.credentials?.chatId ||
      ''
    ).trim();
  }

  public static async testConnection(integration: SocialIntegration): Promise<IntegrationTestResult> {
    const botToken = this.getBotToken(integration);
    const chatId = this.getChatId(integration);

    if (!botToken) {
      return {
        status: 'failed',
        message: 'Telegram Bot Token is required (e.g. from @BotFather).',
        error: 'Missing bot token',
      };
    }

    // Step 1: Verify Bot Identity
    const meRes = await proxyFetch({
      url: `https://api.telegram.org/bot${botToken}/getMe`,
      method: 'GET',
    });

    if (!meRes.ok || !meRes.data?.ok) {
      return {
        status: 'failed',
        message: meRes.data?.description || meRes.error || 'Invalid Telegram Bot Token.',
        latencyMs: meRes.latencyMs,
        statusCode: meRes.status,
        error: meRes.data?.description || meRes.error,
      };
    }

    const botName = meRes.data.result?.username || 'Telegram Bot';

    // Step 2: If Chat/Channel ID provided, test permissions in that channel
    if (chatId) {
      const chatRes = await proxyFetch({
        url: `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`,
        method: 'GET',
      });

      if (chatRes.ok && chatRes.data?.ok) {
        const chatTitle = chatRes.data.result?.title || chatRes.data.result?.username || chatId;
        return {
          status: 'success',
          message: `Connected: Bot @${botName} has access to channel "${chatTitle}".`,
          latencyMs: meRes.latencyMs + chatRes.latencyMs,
          statusCode: 200,
          accountInfo: `@${botName} → ${chatTitle}`,
        };
      }
    }

    return {
      status: 'success',
      message: `Connected successfully to Bot @${botName}. (Tip: Add Chat ID to test target channel)`,
      latencyMs: meRes.latencyMs,
      statusCode: 200,
      accountInfo: `@${botName}`,
    };
  }

  public static async publishPost(
    integration: SocialIntegration,
    payload: TelegramPostPayload
  ): Promise<PublishingResult> {
    const botToken = this.getBotToken(integration);
    const chatId = this.getChatId(integration);

    if (!botToken || !chatId) {
      return {
        platform: 'telegram',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: 'Missing Telegram botToken or chatId',
        timestamp: Date.now(),
      };
    }

    const tagsStr = (payload.tags || [])
      .map((t) => `#${t.replace(/\s+/g, '_')}`)
      .join(' ');

    const messageText = `📢 <b>${payload.title}</b>\n\n${payload.summary}\n\n${
      payload.url ? `🔗 <a href="${payload.url}">Read Full Article</a>\n\n` : ''
    }${tagsStr}`;

    const res = await proxyFetch({
      url: `https://api.telegram.org/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      },
    });

    if (res.ok && res.data?.ok && res.data.result) {
      const msgId = res.data.result.message_id;
      return {
        platform: 'telegram',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'success',
        postId: String(msgId),
        postUrl: chatId.startsWith('@') 
          ? `https://t.me/${chatId.replace('@', '')}/${msgId}` 
          : `https://t.me/c/${chatId}/${msgId}`,
        timestamp: Date.now(),
      };
    } else {
      return {
        platform: 'telegram',
        integrationId: integration.id,
        integrationName: integration.name,
        status: 'failed',
        errorMessage: res.data?.description || res.error || 'Telegram sendMessage failed',
        timestamp: Date.now(),
      };
    }
  }
}
