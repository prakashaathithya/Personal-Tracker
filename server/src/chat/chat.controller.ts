import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { Db } from '../auth/decorators';
import { ChatEvent, ChatService } from './chat.service';

export class ChatTurnDto {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant';
  @IsString() @MinLength(1) @MaxLength(8000) content!: string;
}

export class ChatRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  // Older turns are dropped by the browser; this bounds what one request can cost.
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  messages!: ChatTurnDto[];
}

@UseGuards(AuthGuard)
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chat: ChatService) {}

  /**
   * Answers the last user message, streaming newline-delimited JSON events
   * (`text`, `tool`, `done`, `error`) so the reply appears as it is written.
   */
  @Post()
  @HttpCode(200)
  // Each question costs real API tokens, so it gets a far tighter limit than
  // the app's ordinary reads.
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async ask(
    @Db() db: SupabaseClient,
    @Body() body: ChatRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    // Fail with a normal HTTP error while that is still possible.
    this.chat.assertConfigured();
    if (body.messages[body.messages.length - 1].role !== 'user') {
      res
        .status(400)
        .json({ message: 'The last message must be from the user.' });
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Stop paying for tokens nobody will read once the user leaves.
    const abort = new AbortController();
    res.on('close', () => abort.abort());

    const send = (e: ChatEvent) => res.write(JSON.stringify(e) + '\n');
    try {
      for await (const event of this.chat.answer(
        db,
        body.messages,
        abort.signal,
      )) {
        send(event);
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        this.logger.error('Chat failed', err as Error);
        send({
          type: 'error',
          message: 'Something went wrong. Please try again.',
        });
      }
    } finally {
      res.end();
    }
  }
}
