import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { getSessionFromRequest } from '@/lib/auth';

const BUCKET = 'avatars';
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function ensureBucket() {
  if (!supabaseServer) throw new Error('Database not configured');
  const { data: buckets } = await supabaseServer.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    const { error } = await supabaseServer.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
    });
    if (error && !error.message.includes('already exists')) throw error;
  }
}

function getMemberId(email: string) {
  if (!supabaseServer) throw new Error('Database not configured');
  return supabaseServer
    .from('members')
    .select('id, member_no')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, or WebP.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 2 MB.' }, { status: 400 });
    }

    const { data: member, error: mErr } = await getMemberId(session.email);
    if (mErr) throw mErr;
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    await ensureBucket();

    // Upload with member_no as filename for clean URLs
    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
    const path = `${member.member_no}.${ext}`;

    // Delete any existing avatar files for this member
    const { data: existing } = await supabaseServer.storage.from(BUCKET).list('', {
      search: member.member_no,
    });
    if (existing?.length) {
      await supabaseServer.storage.from(BUCKET).remove(existing.map((f) => f.name));
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabaseServer.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });
    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabaseServer.storage.from(BUCKET).getPublicUrl(path);
    const avatarUrl = urlData.publicUrl;

    // Update member profile
    const { error: profileErr } = await supabaseServer
      .from('member_profiles')
      .upsert(
        { member_id: member.id, avatar_url: avatarUrl },
        { onConflict: 'member_id' },
      );
    if (profileErr) throw profileErr;

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (e) {
    console.error('[Avatar Upload]', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const { data: member, error: mErr } = await getMemberId(session.email);
    if (mErr) throw mErr;
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Remove avatar files
    const { data: existing } = await supabaseServer.storage.from(BUCKET).list('', {
      search: member.member_no,
    });
    if (existing?.length) {
      await supabaseServer.storage.from(BUCKET).remove(existing.map((f) => f.name));
    }

    // Clear avatar_url in profile
    await supabaseServer
      .from('member_profiles')
      .update({ avatar_url: null })
      .eq('member_id', member.id);

    return NextResponse.json({ avatar_url: null });
  } catch (e) {
    console.error('[Avatar Delete]', e);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
