const { FFClient } = require("./lib");

const client = new FFClient({ canvasPoolSize: 0 });
let drawer = client.createDrawer({
  width: 1000,
  height: 1000,
});

drawer.drawFile({
  file: "./gif3.gif",
  x: 0,
  y: 0,
})

drawer.drawFile({
  file: "./gif2.gif",
  x: 1000,
  y: 1000,
  align: "end"
})

drawer.drawFile({
  file: "./gif1.gif",
  align: "center",
  x: 500,
  y: 500,
})


drawer.drawFile({
  file: "./smooth.gif",
  align: {
    x: "start",
    y: "end"
  },
  x: 0,
  y: 500,
})

drawer.drawFile({
  file: "./slow.gif",
  x: 500,
  y: 0,
})

drawer.render({ targetFPS: 1 }).then(console.log).catch(console.error);
