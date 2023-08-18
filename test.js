const { FFClient } = require("./lib");

const client = new FFClient({ canvasPoolSize: 0 });
let drawer = client.createDrawer({
  width: 100,
  height: 100,
});

drawer.drawRectangle({
  height: 30,
  width: 30,
  color: "#ff0000",
  x: 50,
  y: 50,
  align: "end",
  thickness: 5,
}).render().then(console.log).catch(console.error);
