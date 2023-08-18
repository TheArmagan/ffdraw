const Canvas = require("canvas");
const fs = require("fs");

process.on("message", async (msg) => {
  switch (msg.type) {
    case "init": {
      msg.data.fonts.forEach((font) => {
        Canvas.registerFont(font.path, { family: font.family, style: font.style, weight: font.weight });
      });
      process.send({ ok: true, error: null, id: msg.id });
      break;
    }
    case "run": {
      const canvas = Canvas.createCanvas(msg.data.width, msg.data.height);
      const ctx = canvas.getContext("2d");

      const func = eval(`(${msg.data.code})`);

      try {
        await func({ ctx, canvas, data: msg.data.data, Canvas });

        const buffer = canvas.toBuffer("image/png");
        await fs.promises.writeFile(msg.data.output, buffer);
        process.send({ ok: true, error: null, id: msg.id });
      } catch (e) {
        process.send({ ok: false, error: `${e}`, id: msg.id });
      }
      break;
    }
  }
})