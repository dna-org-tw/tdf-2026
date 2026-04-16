-- Track sync job phase: syncing → reviewing → done
ALTER TABLE luma_sync_jobs ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'syncing';
