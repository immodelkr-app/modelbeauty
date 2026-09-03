// @toast-ui/editor의 package.json "exports" 맵에 타입 조건이 없어
// TypeScript(bundler moduleResolution)가 번들된 types/index.d.ts를 찾지 못한다.
// 실제로 사용하는 API 표면만 최소한으로 선언한다.
declare module "@toast-ui/editor" {
  interface AddImageBlobHookCallback {
    (url: string, altText: string): void;
  }

  interface EditorOptions {
    el: HTMLElement;
    height?: string;
    initialEditType?: "markdown" | "wysiwyg";
    previewStyle?: "tab" | "vertical";
    language?: string;
    initialValue?: string;
    hooks?: {
      addImageBlobHook?: (blob: Blob, callback: AddImageBlobHookCallback) => void;
    };
  }

  export default class Editor {
    constructor(options: EditorOptions);
    on(eventName: string, handler: (...args: unknown[]) => void): void;
    getHTML(): string;
    getMarkdown(): string;
    setHTML(html: string): void;
    destroy(): void;
  }
}
