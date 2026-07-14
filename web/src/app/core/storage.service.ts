import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { supabase } from './supabase.client';

/**
 * Receipt file storage. Objects live under `<uid>/...` in the private
 * `receipts` bucket, which storage RLS scopes to the signed-in user.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly auth = inject(AuthService);
  private readonly bucket = 'receipts';

  async uploadReceipt(txnId: string, file: File): Promise<string> {
    const uid = this.auth.user()?.id;
    if (!uid) throw new Error('Not signed in');
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const path = `${uid}/${txnId}.${ext}`;
    const { error } = await supabase.storage
      .from(this.bucket)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return path;
  }

  async signedUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(this.bucket)
      .createSignedUrl(path, 60);
    if (error) throw error;
    return data.signedUrl;
  }

  async removeReceipt(path: string): Promise<void> {
    await supabase.storage.from(this.bucket).remove([path]);
  }
}
