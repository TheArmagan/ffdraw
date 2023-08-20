const { FFClient } = require("./lib");

const client = new FFClient({ canvasPoolSize: 0 });

let stuff = client.createDrawer({
  width: 1000,
  height: 1000,
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

stuff.drawText({
  text: "Hello, world! ❤️ '",
  x: 250,
  y: 250,
  align: "center",
  size: 40,
  shadow: {
    color: "red",
    x: 2,
    y: 2,
  }
})

// drawer.drawFile({
//   file: "./slow.gif",
//   x: 500,
//   y: 0,
// })

stuff.render().then(console.log).catch(console.error);
