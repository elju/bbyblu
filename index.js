const osc = require('osc');

const udpPort = new osc.UDPPort({
  localAddress: '127.0.0.1',
  localPort: 9000,
  remoteAddress: '127.0.0.1',
  remotePort: 8000,
  metadata: true
});

const DEBUG = true,
  NUM_TRACKS = 8;

udpPort.open();

udpPort.on('ready', function() {
  global.udpPort = udpPort;
  global.bbyblu = new BbyBlu(udpPort);
  bbyblu.play();
});

class BbyBlu {
  constructor(udpPort) {
    this._port = udpPort;
    this._state = {};
    this.clip_matrix = new ClipMatrix();
    this.register();
    setInterval(this.updateClipMatrix.bind(this), 10000);
    setInterval(() => {
      let prom = this.clip_matrix.getRandomPresentClip();
      prom.then(this.launchClipByProps.bind(this));
    }, 10000);
    if (DEBUG) { this.registerDebug(); }
  }

  launchClipByProps(track, scene) {
    this._port.send({
      address: `/track/${track + 1}/clip/${scene + 1}/launch`,
      args: []
    });
  }

  processMessage(msg, info) {
    if (msg.address) {
      this._state[msg.address] = msg.args
    }
  }

  register() {
    this._port.on('message', this.processMessage.bind(this));
  }

  registerDebug() {
    this._port.socket.on('close', function() {
      debugger;
      console.log('SOCKET CLOSED!');
    });
  }

  updateClipMatrix() {
    this.clip_matrix.update(this._state);
  }
}

class ClipMatrix {
  constructor() {
    this._matrix = [...Array(NUM_TRACKS)].map(()=>[]);
  }

  getRandomPresentClip(timeout = 0) {
    let clip, prom, x, y;

    prom = new Promise((res, rej) => {
      x = Math.floor(Math.random() * NUM_TRACKS);
      y = Math.floor(Math.random() * NUM_TRACKS);

      if (clip = this._matrix[x][y]) {
        console.log("Clip found! resolving promise...");
        res(x, y);
      }

      setTimeout(() => {
        this.getRandomPresentClip().then(res);
      }, 150);
    });

    return prom;
  }

  update(state) {
    let match, scene, track, val;
    Object.keys(state).forEach(key => {
      if (match = this.clipPresence.exec(key)) {
        console.log("Clip found! State looks like: ");
        console.log(state[key]);

        // JS matricies are zero indexed so we subtract one
        track = parseInt(match[1], 10) - 1;
        scene = parseInt(match[2], 10) - 1;

        console.log("Track and scene are: ", track, scene);
        console.log("Clip matrix looks like: ");
        console.log(this._matrix);

        val = !!state[key][0].value;
        this._matrix[track][scene] = val;
      }
    })
  }
}

ClipMatrix.prototype.clipPresence = /\/track\/(\d)\/clip\/(\d)\/hasContent/;

toggleFactory = function(addr) {
  return function() {
    this._port.send({
      address: addr,
      args: []
    });
  };
}

BbyBlu.prototype.play = toggleFactory('/play');
BbyBlu.prototype.stop = toggleFactory('/stop');
BbyBlu.prototype.record = toggleFactory('/record');
BbyBlu.prototype.overdub = toggleFactory('/overdub');
BbyBlu.prototype.launcherOverdub = toggleFactory('/overdub/launcher');

global.BbyBlu = BbyBlu;
