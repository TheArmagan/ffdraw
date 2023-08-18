# FFDraw

Canvas variant that supports GIFs using ffmpeg. Also its fully async and fast.

```js
const { FFClient } = require("ffdraw");

const client = new FFClient({ canvasPoolSize: 4 });

const drawer = client.createDrawer({
  width: 100,
  height: 100,
  backgroundImage: "./myBg.png", // its optional, uses black background by default
});

// other than drawCanvas everything else uses native ffmpeg filters soo its much faster
drawer
  .drawFile({
    file: "./cat.gif",
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  })
  .drawFile({
    file: "./wings.gif",
    x: "(main_w-overlay_w)/2",
    y: "(main_h-overlay_h)/2",
    height: 200, // height and width is optional, it will be calculated and scaled automatically
  })
  .drawFile({
    file: "./human.png",
    x: "(main_w-overlay_w)/2",
    y: "(main_h-overlay_h)/2",
    height: 200,
  })
  .drawText({
    text: "Hello World",
    x: 10,
    y: 10,
    font: "Arial",
    size: 20,
    color: "#ffffff",
  })
  .drawText({
    text: "selam",
    x: "(w-text_w)/2",
    y: "(h-text_h)/2",
    font: "Arial", // ttf path or font name
    size: 30,
    color: "#ff0000",
    background: {
      // background is optional
      color: "#00000030",
      padding: 5,
    },
  })
  .drawText({
    text: "selam",
    x: 50,
    y: 50,
    font: "Arial", // ttf path or font name
    size: 30,
    color: "#ff0000",
    background: {
      // background is optional
      color: "#00000030",
      padding: 5,
    },
    align: {
      // align is optional
      x: "center",
      y: "center",
    },
  })
  .drawRectangle({
    x: 100,
    y: 100,
    width: 25,
    height: 25,
    color: "#00ff00",
  })
  .drawRectangle({
    x: 100,
    y: 150,
    width: 25,
    height: 25,
    color: "#00ffff",
    thickness: 3, // thickness is optional
  })
  .drawFile({
    file: "cradwings.gif",
    x: 0,
    y: 0,
  })
  .drawCanvas({
    draw: ({ ctx, canvas, data }) => {
      // it is important to use arrow functions here because this function is runs in a different context
      ctx.fillStyle = "#ffff00";
      ctx.fillRect(0, 0, 50, 50);
    },
    x: 0,
    y: 0,
    width: 675,
    height: 676,
    data: {},
  })
  .render({ targetFPS: 30 })
  .then(console.log)
  .catch(console.error)
  .finally(() => client.destroy());
```
