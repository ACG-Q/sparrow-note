// pdfjs-dist 只给包根注册了类型，`build/pdf.mjs` 这个子路径没有声明文件。
// 这里补一个，顺带把阅读器用到的 API 收窄成具体类型。
declare module "pdfjs-dist/build/pdf.mjs" {
  export interface PdfViewport {
    width: number;
    height: number;
  }

  export interface PdfRenderTask {
    promise: Promise<void>;
    cancel(): void;
  }

  export interface PdfPage {
    getViewport(params: { scale: number }): PdfViewport;
    render(params: {
      canvas?: HTMLCanvasElement;
      canvasContext: CanvasRenderingContext2D;
      viewport: PdfViewport;
    }): PdfRenderTask;
  }

  export interface PdfDocument {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPage>;
    destroy(): Promise<void>;
  }

  export const GlobalWorkerOptions: { workerSrc: string };

  export function getDocument(src: { url: string }): { promise: Promise<PdfDocument> };
}
