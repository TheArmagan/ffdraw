const cp = require('child_process');

class ForkPool {
  constructor(size, { path, initData }) {
    this.size = size;
    this.path = path;
    this.pool = [];

    for (let i = 0; i < size; i++) {
      let fork = cp.fork(path);
      fork.send({ type: 'init', data: initData });
      this.pool.push({
        busy: false,
        fork
      });
    }
  }

  destroy() {
    this.pool.forEach((worker) => {
      worker.fork.kill();
    });
    this.pool.length = 0;
  }

  getFreeFork() {
    return this.pool.find((worker) => !worker.busy);
  }

  run(data) {
    return new Promise(async (resolve, reject) => {
      let worker = this.getFreeFork();
      while (!worker) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        worker = this.getFreeFork();
      }
      worker.busy = true;
      let id = Math.random().toString(36).slice(2);
      worker.fork.send({ id, data, type: 'run' });

      function onMessage(msg) {
        if (msg.id === id) {
          worker.fork.removeListener('message', onMessage);
          worker.busy = false;
          resolve(msg);
        }
      }

      worker.fork.on('message', onMessage);
    });
  }
}

module.exports = ForkPool;