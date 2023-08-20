const fs = require('fs');
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffprobe = require("util").promisify(ffmpeg.ffprobe);
const ForkPool = require('./ForkPool.js');
const typesOfAlign = ["text", "overlay"];
// center => x = targetX-(text_w/2)
/**
 * @param {number} coord
 * @param {"text" | "overlay"} type
 * @param {"center" | "start" | "end"} to
 * @param {"width" | "height"} coordType
 */
function alignCoord(coord, to = "start", type = "text", coordType = "width") {
  switch (to) {
    case "center": {
      return `${coord}-(${typesOfAlign.includes(type) ? `${type}_` : ""}${coordType === "width" ? "w" : "h"}/2)`;
    }
    case "start": {
      return coord;
    }
    case "end": {
      return `${coord}-(${typesOfAlign.includes(type) ? `${type}_` : ""}${coordType === "width" ? "w" : "h"})`;
    }
  }
}

class FFClient {
  /**
   * @param {{ canvasPoolSize?: number, canvasFonts?: {path: string, family: string, weight?: number, style?: string}[], tempDir?: string }} param0 
   */
  constructor({ canvasPoolSize = 1, canvasFonts = [], tempDir } = {}) {
    this.canvasPool = new ForkPool(canvasPoolSize, {
      path: path.resolve(__dirname, "./canvas-worker.js"),
      initData: {
        fonts: canvasFonts
      }
    });
    this.tempDir = tempDir ?? path.resolve(__dirname, "../temp");
  }
  /**
   * @param {{ width: number, height: number, backgroundImage: string }} param0 
   */
  createDrawer({ width, height, backgroundImage } = {}) {
    return new FFDrawer(this, { width, height, backgroundImage });
  }

  destroy() {
    this.canvasPool.destroy();
  }
}

const canvasTextDrawer = async ({ ctx, data }) => {
  data.texts.forEach(text => {
    ctx.font = `${text.weight ?? "normal"} ${text.size}px ${text.font ?? "Monospace"}`;
    ctx.textAlign = text.align?.x;
    ctx.textBaseline = ({ start: "top", center: "middle", end: "bottom" })[text.align?.y ?? "start"];
    if (text.shadow) {
      ctx.fillStyle = text.shadow?.color ?? "black";
      ctx.fillText(text.text, text.x + text.shadow.x, text.y + text.shadow.y);
    }
    if (text.outline) {
      ctx.strokeStyle = text.outline.color;
      ctx.lineWidth = text.outline.width;
      ctx.strokeText(text.text, text.x, text.y);
    }
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
  });
}

class FFDrawer {
  /**
   * @param {FFClient} client 
   * @param {{ width: number, height: number, backgroundImage: string }} param1 
   */
  constructor(client, { width, height, backgroundImage } = {}) {
    this.client = client;
    this.width = width;
    this.height = height;
    this.steps = [];
    this.backgroundImage = backgroundImage ?? path.resolve(__dirname, "./assets/bg.png");
    this._id = 0;
  }

  generateId() {
    return `id${this._id++}`;
  }
  /**
   * @param {{ file: string, x: number, y: number, width?: number, height?: number, align?: { x: "start" | "center" | "end", y: "start" | "center" | "end" } | "start" | "center" | "end" }} param0 
   */
  drawFile({ file, x, y, width, height, align }) {
    align = typeof align === "string" ? { x: align, y: align } : align;
    this.steps.push({
      index: this.steps.length,
      type: "drawFile",
      data: {
        file,
        x,
        y,
        width,
        height,
        align
      }
    });

    return this;
  }
  /**
   * if type is "native" then it will use ffmpeg drawtext filter to draw text, otherwise it will use canvas to draw text. btw all text will be drawn on a single canvas.
   * @param {{ text: string, x: number, y: number, font?: string, size: string, color?: string, align?: "start" | "center" | "end" | { x: "start" | "center" | "end", y: "start" | "center" | "end" } | "start" | "center" | "end", shadow?: { color: string, x: number, y: number }, border?: { color: string, x: number, y: number }, type?: "native" | "canvas", weight?: "normal" | "bold" | number }} param0 
   */
  drawText({ text, x, y, font, size, color, align, shadow, border, type, weight }) {
    align = typeof align === "string" ? { x: align, y: align } : align;
    type = type ?? "native";
    text = String(text);
    this.steps.push({
      index: this.steps.length,
      type: "drawText",
      data: {
        text,
        x,
        y,
        font,
        size,
        color,
        align,
        shadow,
        border,
        type,
        weight
      }
    });
    return this;
  }

  /**
   * @param {{ x: number, y: number, width: number, height: number, color: string, thickness?: number, align?: { x: "start" | "center" | "end", y: "start" | "center" | "end" } | "start" | "center" | "end" }} param0
   */
  drawRectangle({ x, y, width, height, color, thickness, align }) {
    align = typeof align === "string" ? { x: align, y: align } : align;
    this.steps.push({
      index: this.steps.length,
      type: "drawRectangle",
      data: {
        x,
        y,
        width,
        height,
        color,
        thickness,
        align
      }
    });
    return this;
  }

  /**
   * @param {{ draw: (obj: { ctx: import("canvas").CanvasRenderingContext2D, canvas: import("canvas").Canvas, data: any, Canvas: typeof import("canvas").Canvas }) => void | Promise<void>, x: number, y: number, width: number, height: number, data: any, align?: { x: "start" | "center" | "end", y: "start" | "center" | "end" } | "start" | "center" | "end" }} param0 
   */
  drawCanvas({ draw, x, y, width, height, data, align }) {
    align = typeof align === "string" ? { x: align, y: align } : align;
    this.steps.push({
      index: this.steps.length,
      type: "drawCanvas",
      data: {
        draw,
        x,
        y,
        width,
        height,
        data,
        align
      }
    });
    return this;
  }

  /**
   * @param {{ targetFPS?: number, useSeparateCanvasLayersForText?: boolean }} param0
   * @returns {Promise<{ clear: () => Promise<any>, result: { path: string, buffer: () => Promise<Buffer> }, took: number }>}
   */
  render({ targetFPS = -1, useSeparateCanvasLayersForText = false } = {}) {
    const self = this;
    return new Promise(async (resolve, reject) => {
      let startTime = Date.now();
      let mainFF = ffmpeg();

      const tempDir = path.resolve(this.client.tempDir, `./r-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      if (!fs.existsSync(tempDir)) await fs.promises.mkdir(tempDir, { recursive: true });

      let filters = [];
      let inputIdx = 0;
      function addInput(input, inputOptions = []) {
        mainFF.input(input);
        if (inputOptions.length) {
          inputOptions.forEach(([key, value]) => {
            mainFF.inputOption(key, value);
          });
        }
        return `${inputIdx++}`;
      }

      let bgInput = addInput(this.backgroundImage);
      let bgInputScaled = this.generateId();

      filters.push(
        {
          filter: "scale",
          options: [this.width, this.height],
          inputs: [bgInput],
          outputs: [bgInputScaled]
        }
      )

      let lastOutput = bgInputScaled;

      let isAnimated = this.steps.some(step => step.type === "drawFile" && step.data.file.endsWith(".gif"));

      let targetDuration = Math.max(
        ...(await Promise.all(
          this.steps
            .filter(step => step.type === "drawFile" && step.data.file.endsWith(".gif"))
            .map(async step => {
              let { format: { duration } } = await ffprobe(step.data.file);
              return duration;
            })
        ))
      );

      let pendingCanvasPromises = [];

      let canvasSteps = this.steps.filter(i => i.type === "drawCanvas");

      let canvasTextDrawSteps = this.steps.filter(i => i.type === "drawText" && i.data.type === "canvas");

      if (canvasTextDrawSteps.length) {
        if (useSeparateCanvasLayersForText) {
          canvasTextDrawSteps.forEach(step => {
            canvasSteps.push({
              index: step.index,
              type: "drawCanvas",
              data: {
                draw: canvasTextDrawer,
                data: {
                  texts: [step.data]
                },
                x: 0,
                y: 0,
                width: self.width,
                height: self.height,
              }
            })
          });
        } else {
          canvasSteps.push({
            index: canvasTextDrawSteps[0].index,
            type: "drawCanvas",
            data: {
              draw: canvasTextDrawer,
              data: {
                texts: canvasTextDrawSteps.map(i => i.data)
              },
              x: 0,
              y: 0,
              width: self.width,
              height: self.height,
            }
          })
        }
      }


      for (let step of canvasSteps) {
        const outputPath = path.resolve(tempDir, `${this.generateId()}.png`);
        pendingCanvasPromises.push(
          new Promise(async (res, rej) => {
            let d = await this.client.canvasPool.run({
              code: step.data.draw.toString(),
              width: step.data.width,
              height: step.data.height,
              data: step.data.data,
              output: outputPath
            });
            if (!d.ok) return rej(d.error);
            res({
              file: outputPath,
              width: step.data.width,
              height: step.data.height,
              align: step.data.align
            });
          })
        )
      }

      let resolvedCanvasPromises = await Promise.all(pendingCanvasPromises);

      let steps = [
        ...this.steps.filter(i => {
          if (i.type === "drawCanvas") return false;
          if (i.type === "drawText" && i.data.type === "canvas") return false;
          return true;
        }),
        ...resolvedCanvasPromises.map((data) => ({
          type: "drawFile",
          data: data
        }))
      ];

      steps.sort((a, b) => a.index - b.index);

      for (let step of steps) {
        switch (step.type) {
          case "drawFile": {
            let fileInput = addInput(step.data.file,
              step.data.file.endsWith("gif")
                ? [["-ignore_loop", '0'], ["-t", `${targetDuration}`]]
                : []
            );
            let hasScale = typeof step.data.width !== "undefined" || typeof step.data.height !== "undefined";
            let outputId0 = this.generateId();
            let outputId1 = this.generateId();
            filters.push(
              ...[
                hasScale ? {
                  filter: "scale",
                  options: [step.data.width ?? -1, step.data.height ?? -1],
                  inputs: [fileInput],
                  outputs: [outputId0]
                } : null,
                {
                  filter: "overlay",
                  options: {
                    x: alignCoord(step.data.x ?? 0, step.data.align?.x, "overlay", "width"),
                    y: alignCoord(step.data.y ?? 0, step.data.align?.y, "overlay", "height"),
                  },
                  inputs: [lastOutput, hasScale ? outputId0 : fileInput],
                  outputs: [outputId1]
                }
              ].filter(Boolean)
            );
            lastOutput = outputId1;
            break;
          };
          case "drawText": {
            let outputId = this.generateId();
            filters.push(
              {
                filter: "drawtext",
                options: {
                  text: step.data.text.replaceAll("'", "`"),
                  x: alignCoord(step.data.x ?? 0, step.data.align?.x, "text", "width"),
                  y: alignCoord(step.data.y ?? 0, step.data.align?.y, "text", "height"),
                  [step.data.font && fs.existsSync(step.data.font) ? "fontfile" : "font"]: step.data.font ?? path.resolve(__dirname, "./assets/font.ttf"),
                  fontsize: step.data.size ?? 12,
                  fontcolor: step.data.color ?? "#ffffff",
                  ...(step.data.background?.color ? {
                    box: 1,
                    boxcolor: step.data.background?.color ?? "#000000",
                    boxborderw: step.data.background?.width ?? 3,
                  } : {}),
                  ...(step.data.shadow?.color ? {
                    shadowcolor: step.data.shadow?.color ?? "#000000",
                    shadowx: step.data.shadow?.x ?? 0,
                    shadowy: step.data.shadow?.y ?? 0,
                  } : {}),
                  ...(step.data.border?.color ? {
                    bordercolor: step.data.shadow?.color ?? "#000000",
                    borderw: step.data.background?.width ?? 3
                  } : {})
                },
                inputs: [lastOutput],
                outputs: [outputId]
              }
            );
            lastOutput = outputId;
            break;
          }
          case "drawRectangle": {
            let outputId = this.generateId();
            filters.push(
              {
                filter: "drawbox",
                options: {
                  x: alignCoord(step.data.x ?? 0, step.data.align?.x, null, "width"),
                  y: alignCoord(step.data.y ?? 0, step.data.align?.y, null, "height"),
                  width: step.data.width ?? 0,
                  height: step.data.height ?? 0,
                  color: step.data.color ?? "#ffffff",
                  t: (typeof step.data.thickness === "undefined" || step.data.thickness === -1) ? "fill" : step.data.thickness,
                },
                inputs: [lastOutput],
                outputs: [outputId]
              }
            );
            lastOutput = outputId;
            break;
          }
        }
      }

      if (isAnimated) {
        let split1Id = this.generateId();
        let split2Id = this.generateId();

        let extraId = this.generateId();

        let outputId = this.generateId();
        filters.push(
          {
            filter: "split",
            inputs: [lastOutput],
            outputs: [split1Id, split2Id]
          },
          {
            filter: "palettegen",
            options: {
              reserve_transparent: "1",
              stats_mode: "full"
            },
            inputs: [split1Id],
            outputs: ["palette"]
          },
          {
            filter: "paletteuse",
            options: {
              dither: "bayer:bayer_scale=5",
              new: "1"
            },
            inputs: [split2Id, 'palette'],
            outputs: [targetFPS > 0 ? extraId : outputId]
          }
        );
        if (targetFPS > 0) {
          filters.push({
            filter: "fps",
            options: [targetFPS],
            inputs: [extraId],
            outputs: [outputId]
          });
        }
        lastOutput = outputId;
      }

      mainFF.complexFilter(filters);
      mainFF.map(`[${lastOutput}]`);
      const outputFileName = path.join(tempDir, `./result.${isAnimated ? "gif" : "png"}`);
      mainFF.once("end", () => {
        mainFF.removeAllListeners();
        resolve({
          async clear() {
            return await fs.promises.rm(tempDir, { force: true, recursive: true });
          },
          result: {
            path: outputFileName,
            async buffer() {
              return await fs.promises.readFile(outputFileName);
            }
          },
          took: Date.now() - startTime
        });
        resolvedCanvasPromises.forEach(i => {
          fs.promises.rm(i.file, { force: true }).catch(() => { });
        });
      })
      mainFF.once("error", (err) => {
        mainFF.removeAllListeners();
        reject(new Error(err));
        fs.promises.rm(tempDir, { force: true, recursive: true }).catch(() => { });
      });
      mainFF.output(outputFileName);
      mainFF.run();
    })
  }
}

module.exports = {
  FFDrawer,
  FFClient
}