const fs = require('fs');
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffprobe = require("util").promisify(ffmpeg.ffprobe);
const ForkPool = require('./ForkPool.js');

class FFClient {
  /**
   * @param {{ canvasPoolSize: number, canvasFonts: {path: string, family: string, weight?: number, style?: string}[], tempDir?: string }} param0 
   */
  constructor({ canvasPoolSize = 4, canvasFonts = [], tempDir } = {}) {
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

  drawFile({ file, x, y, width, height }) {
    this.steps.push({
      type: "drawFile",
      data: {
        file,
        x,
        y,
        width,
        height
      }
    });

    return this;
  }

  drawText({ text, x, y, font, size, color, background }) {
    this.steps.push({
      type: "drawText",
      data: {
        text,
        x,
        y,
        font,
        size,
        color,
        background
      }
    });
    return this;
  }

  /**
   * @param {{ x: number, y: number, width: number, height: number, color: string, thickness?: number }} param0
   */
  drawRectangle({ x, y, width, height, color, thickness }) {
    this.steps.push({
      type: "drawRectangle",
      data: {
        x,
        y,
        width,
        height,
        color,
        thickness
      }
    });
    return this;
  }

  /**
   * @param {{ draw: (obj: { ctx: import("canvas").CanvasRenderingContext2D, canvas: import("canvas").Canvas, data: any, Canvas: typeof import("canvas").Canvas }) => void | Promise<void>, x: number, y: number, width: number, height: number, data: any }} param0 
   * @returns {FFDrawer}
   */
  drawCanvas({ draw, x, y, width, height, data }) {
    this.steps.push({
      type: "drawCanvas",
      data: {
        draw,
        x,
        y,
        width,
        height,
        data
      }
    });
    return this;
  }

  /**
   * @returns {Promise<{ clear: () => Promise<any>, result: { path: string, buffer: () => Promise<Buffer> }, took: number }>}
   */
  render() {
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

      for (let step of canvasSteps) {
        const outputPath = path.resolve(tempDir, `${this.generateId()}.png`);
        pendingCanvasPromises.push(
          new Promise(async (res, rej) => {
            let d = await this.client.canvasPool.run({
              code: step.data.draw.toString(),
              width: step.data.width,
              height: step.data.height,
              data: step.data.data,
              output: outputPath,
              fonts: step.data.fonts ?? []
            });
            if (!d.ok) return rej(d.error);
            res({
              file: outputPath,
              width: step.data.width,
              height: step.data.height
            });
          })
        )
      }

      let resolvedCanvasPromises = await Promise.all(pendingCanvasPromises);

      let steps = [
        ...this.steps.filter(i => i.type !== "drawCanvas"),
        ...resolvedCanvasPromises.map((data) => ({
          type: "drawFile",
          data: data
        }))
      ];

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
                    x: step.data.x ?? 0,
                    y: step.data.y ?? 0
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
                  text: step.data.text,
                  x: step.data.x ?? 0,
                  y: step.data.y ?? 0,
                  [step.data.font && fs.existsSync(step.data.font) ? "fontfile" : "font"]: step.data.font ?? path.resolve(__dirname, "./assets/font.ttf"),
                  fontsize: step.data.size ?? 12,
                  fontcolor: step.data.color ?? "#ffffff",
                  box: step.data.background ? 1 : 0,
                  boxcolor: step.data.background?.color ?? "#00000000",
                  boxborderw: step.data.background?.padding ?? 5,
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
                  x: step.data.x ?? 0,
                  y: step.data.y ?? 0,
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
            outputs: [outputId]
          }
        );
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