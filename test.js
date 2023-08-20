const { FFClient } = require("./lib");

const client = new FFClient({ canvasPoolSize: 1 });

let stuff = client.createDrawer({
  width: 1000,
  height: 100,
});

// stuff.drawFile({
//   file: "./gif3.gif",
//   x: 0,
//   y: 0,
// })

// stuff.drawFile({
//   file: "./gif2.gif",
//   x: 1000,
//   y: 1000,
//   align: "end"
// })

// stuff.drawFile({
//   file: "./gif1.gif",
//   align: "center",
//   x: 500,
//   y: 500,
// })


// stuff.drawFile({
//   file: "./smooth.gif",
//   align: {
//     x: "start",
//     y: "end"
//   },
//   x: 0,
//   y: 500,
// })

// stuff.drawText({
//   text: "Hello, world! ❤️ '",
//   x: 1000,
//   y: 1000,
//   align: "end",
//   size: 40,
//   type: "canvas",
//   color: "white",
//   shadow: {
//     color: "red",
//     x: 2,
//     y: 2,
//   }
// })

stuff.drawText({
  text: "Abcdefghijklmnopqrstuvwxyz",
  x: 1,
  y: 1,
  size: 16,
  type: "canvas",
  color: "red",
})

stuff.drawText({
  text: "Abcdefghijklmnopqrstuvwxyz",
  x: 1,
  y: 1,
  size: 16,
  type: "canvas",
  color: "red",
})

stuff.drawText({
  text: "Abcdefghijklmnopqrstuvwxyz",
  x: 1,
  y: 1,
  size: 16,
  type: "canvas",
  color: "red",
})

// drawer.drawFile({
//   file: "./slow.gif",
//   x: 500,
//   y: 0,
// })

stuff.render().then(console.log).catch(console.error).then(() => client.destroy());
