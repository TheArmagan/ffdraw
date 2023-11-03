export class FFClient {
  constructor(opts: { canvasPoolSize?: number, canvasFonts?: { path: string, family: string, weight?: number, style?: string }[], tempDir?: string } | undefined);
  createRenderer(opts: { width: number, height: number, backgroundImage?: string }): FFRenderer;
  destroy(): void;
}

export class FFRenderer {
  client: FFClient;
  width: number;
  height: number;
  backgroundImage: string;

  constructor(client: FFClient, opts: { width: number, height: number, backgroundImage?: string });

  drawFile(opts: { file: string, x: number, y: number, width?: number, height?: number, align?: { x: "start" | "center" | "end", y: "start" | "center" | "end" } | "start" | "center" | "end" }): FFRenderer;

  /**
   * if type is "native" then it will use ffmpeg drawtext filter to draw text, otherwise it will use canvas to draw text. 
   */
  drawText(opts: { text: string, x: number, y: number, font?: string, size: string, color?: string, align?: "start" | "center" | "end" | { x: "start" | "center" | "end", y: "start" | "center" | "end" } | "start" | "center" | "end", shadow?: { color: string, x: number, y: number }, border?: { color: string, x: number, y: number }, type?: "native" | "canvas", weight?: "normal" | "bold" | number }): FFRenderer;

  drawRectangle(opts: { x: number, y: number, width: number, height: number, color: string, thickness?: number, align?: { x: "start" | "center" | "end", y: "start" | "center" | "end" } | "start" | "center" | "end" }): FFRenderer;

  drawCanvas<TData extends any>(opts: { draw: (obj: { ctx: import("canvas").CanvasRenderingContext2D, canvas: import("canvas").Canvas, data: TData, Canvas: typeof import("canvas").Canvas }) => void | Promise<void>, x: number, y: number, width: number, height: number, data: TData, align?: { x: "start" | "center" | "end", y: "start" | "center" | "end" } | "start" | "center" | "end" }): FFRenderer;

  /**
   * do not forget to call clear() after render() to free resources
   */
  render(opts: { targetFPS?: number, useSeparateCanvasLayersForText?: boolean }): Promise<{ clear: () => Promise<void>, result: { path: string, buffer: () => Promise<Buffer>, write: (path: string) => Promise<void> }, took: number }>
}