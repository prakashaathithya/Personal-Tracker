import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { Db } from '../auth/decorators';
import { handle } from '../common/handle';

@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  /** Newest first, with the unread count the bell badge shows. */
  @Get()
  async list(
    @Db() db: SupabaseClient,
    @Query('limit') limit?: string,
    @Query('unread') unread?: string,
  ) {
    let q = db
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 30, 100));
    if (unread === 'true') q = q.is('read_at', null);

    const data = await handle(q);
    const { count } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);

    return { data, unread: count ?? 0 };
  }

  @Post(':id/read')
  read(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(
      db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single(),
    );
  }

  @Post('read-all')
  async readAll(@Db() db: SupabaseClient) {
    await handle(
      db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null),
    );
    return { ok: true };
  }

  @Delete(':id')
  remove(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(db.from('notifications').delete().eq('id', id));
  }
}
