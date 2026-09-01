// ============================================================
// POST /api/reviews/upload — 리뷰 사진 업로드 (로그인 회원)
// multipart/form-data, field name "file"
// jpg/png/webp/gif, 5MB 이하만 허용, Supabase Storage(product-images)에 저장
// ============================================================

import { randomUUID } from "crypto";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }
    const masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return Response.json({ success: false, error: "업로드할 파일이 없습니다." }, { status: 400 });
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return Response.json(
        { success: false, error: "jpg, png, webp, gif 형식의 이미지만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return Response.json(
        { success: false, error: "파일 용량은 5MB를 초과할 수 없습니다." },
        { status: 400 }
      );
    }

    const path = `reviews/${masterUserId}/${randomUUID()}.${ext}`;
    const admin = createSupabaseAdmin();
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await admin.storage
      .from("product-images")
      .upload(path, Buffer.from(arrayBuffer), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[POST /api/reviews/upload] Storage error:", uploadError);
      return Response.json({ success: false, error: "업로드에 실패했습니다." }, { status: 500 });
    }

    const { data } = admin.storage.from("product-images").getPublicUrl(path);

    return Response.json({ success: true, url: data.publicUrl });
  } catch (err) {
    console.error("[POST /api/reviews/upload] Unexpected error:", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
