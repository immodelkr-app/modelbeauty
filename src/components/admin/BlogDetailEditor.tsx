"use client";

// ============================================================
// BlogDetailEditor — 블로그 형식(사진+글 자유 배치) 상세페이지 에디터
// Toast UI Editor 래퍼. 이미지는 드래그&드롭/붙여넣기 시 /api/admin/upload로
// 자동 업로드되고, 최종 결과는 onChange로 HTML을 넘긴다(저장 전 서버에서 sanitize).
// ============================================================

import { useEffect, useRef } from "react";
import "@toast-ui/editor/dist/toastui-editor.css";

interface BlogDetailEditorProps {
  initialHtml: string;
  onChange: (html: string) => void;
}

export default function BlogDetailEditor({ initialHtml, onChange }: BlogDetailEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    let editor: import("@toast-ui/editor").default | null = null;
    let disposed = false;

    import("@toast-ui/editor").then(({ default: Editor }) => {
      if (disposed || !containerRef.current) return;

      editor = new Editor({
        el: containerRef.current,
        height: "520px",
        initialEditType: "wysiwyg",
        previewStyle: "vertical",
        language: "ko-KR",
        initialValue: initialHtml && initialHtml.trim() ? initialHtml : " ",
        hooks: {
          addImageBlobHook: async (blob: Blob, callback: (url: string, altText: string) => void) => {
            try {
              const formData = new FormData();
              formData.append("file", blob, blob instanceof File ? blob.name : "image.png");
              const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
              const result = await res.json();
              if (result.success && result.url) {
                callback(result.url, "이미지");
              } else {
                alert(result.error ?? "이미지 업로드에 실패했습니다.");
              }
            } catch {
              alert("이미지 업로드 중 오류가 발생했습니다.");
            }
          },
        },
      });

      editor.on("change", () => {
        onChangeRef.current(editor!.getHTML());
      });
    });

    return () => {
      disposed = true;
      editor?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} />;
}
