const canvas = document.getElementById("neuro-canvas");
const ctx = canvas.getContext("2d");

const eegCanvas = document.getElementById("eeg-canvas");
const eegCtx = eegCanvas.getContext("2d");

const neuronCountEl = document.getElementById("neuron-count");
const hzCountEl = document.getElementById("hz-count");
const eegRhythmEl = document.getElementById("eeg-rhythm");
const threshSlider = document.getElementById("threshold-slider");
const threshVal = document.getElementById("thresh-val");
const plasticitySlider = document.getElementById("plasticity-slider");
const plasticityVal = document.getElementById("plasticity-val");
const modButtons = document.querySelectorAll(".pill-btn");
const toolButtons = document.querySelectorAll(".tool-btn");
const cascadeBtn = document.getElementById("cascade-btn");
const reconnectBtn = document.getElementById("reconnect-btn");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// Simulation State
let currentMod = "neutral"; // 'neutral', 'dopamine', 'gaba', 'glutamate'
let currentTool = "stim";    // 'stim', 'add', 'cut'
let thresholdVoltage = -55; // mV
let plasticityFactor = 1.0;
let spikeCounter = 0;
let lastHzSampleTime = performance.now();

// EEG Trace History
const EEG_BUFFER_SIZE = 90;
let eegBuffer = new Array(EEG_BUFFER_SIZE).fill(16);

// Action Potential Pulse propagating down an axon
class ActionPotential {
  constructor(synapse) {
    this.synapse = synapse;
    this.progress = 0; // 0 to 1 along axon length
    this.speed = 0.045 + Math.random() * 0.015;
  }

  update() {
    this.progress += this.speed;
    if (this.progress >= 1.0) {
      // Reached post-synaptic dendritic arbor
      this.synapse.target.receiveSpike(this.synapse.weight);
      return false; // Finished transmission
    }
    return true;
  }

  draw() {
    const s = this.synapse;
    const x = s.source.x + (s.target.x - s.source.x) * this.progress;
    const y = s.source.y + (s.target.y - s.source.y) * this.progress;

    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Synapse (Weighted connection between two neurons)
class Synapse {
  constructor(source, target) {
    this.source = source;
    this.target = target;
    this.weight = Math.random() * 8 + 4; // Synaptic efficacy (mV depolarized)
    this.isSevered = false;
  }

  draw() {
    if (this.isSevered) return;

    ctx.save();
    const isFiring = this.source.isRefractory || this.target.isRefractory;
    ctx.strokeStyle = isFiring ? "rgba(56, 189, 248, 0.45)" : "rgba(148, 163, 184, 0.12)";
    ctx.lineWidth = Math.min(3.5, this.weight * 0.22);
    if (isFiring) {
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 6;
    }

    ctx.beginPath();
    ctx.moveTo(this.source.x, this.source.y);
    ctx.lineTo(this.target.x, this.target.y);
    ctx.stroke();
    ctx.restore();
  }
}

// Biological Neuron Model
class Neuron {
  constructor(x, y) {
    this.x = x || Math.random() * (canvas.width - 200) + 100;
    this.y = y || Math.random() * (canvas.height - 200) + 100;

    this.restingPotential = -70; // mV
    this.voltage = -70;          // Dynamic membrane potential
    this.isRefractory = false;
    this.refractoryTimer = 0;
    this.synapses = [];
    this.somaRadius = Math.random() * 2 + 5;
  }

  receiveSpike(amount) {
    if (this.isRefractory) return;

    // Modulate based on chemical bath
    let mod = 1.0;
    if (currentMod === "gaba") mod = -0.8; // Hyperpolarizing IPSP
    if (currentMod === "dopamine") mod = 1.35;
    if (currentMod === "glutamate") mod = 1.6;

    this.voltage += amount * mod;

    // Check if depolarized past threshold
    if (this.voltage >= thresholdVoltage) {
      this.fire();
    }
  }

  fire() {
    this.voltage = 35; // Action potential peak (+35 mV)
    this.isRefractory = true;
    this.refractoryTimer = 18; // Absolute/relative refractory frames
    spikeCounter++;

    // Launch action potentials down all unsevered axonal synapses
    for (let s of this.synapses) {
      if (!s.isSevered) {
        actionPotentials.push(new ActionPotential(s));
        // Hebbian STDP: Strengthen active pathway
        s.weight = Math.min(18, s.weight + 0.3 * plasticityFactor);
      }
    }
  }

  update() {
    if (this.isRefractory) {
      this.refractoryTimer--;
      if (this.refractoryTimer <= 0) {
        this.isRefractory = false;
        this.voltage = this.restingPotential - 5; // Hyperpolarization undershoot
      }
    } else {
      // Passive leak current relaxing membrane toward resting potential
      this.voltage += (this.restingPotential - this.voltage) * 0.08;

      // Spontaneous background thermal noise / synaptic miniature currents
      if (Math.random() < 0.003) {
        this.voltage += Math.random() * 4;
        if (this.voltage >= thresholdVoltage) this.fire();
      }
    }
  }

  draw() {
    ctx.save();
    // Normalized voltage for bioluminescent color map
    const norm = Math.max(0, Math.min(1, (this.voltage - this.restingPotential) / 105));

    let color = "#38bdf8";
    if (this.isRefractory) {
      color = "#ffffff";
    } else if (norm > 0.45) {
      color = "#f43f5e";
    } else if (norm > 0.2) {
      color = "#818cf8";
    }

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = this.isRefractory ? 18 : 6;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.isRefractory ? this.somaRadius * 1.35 : this.somaRadius, 0, Math.PI * 2);
    ctx.fill();

    // Resting halo
    ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.somaRadius + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// Global Network Entities
let neurons = [];
let synapses = [];
let actionPotentials = [];

// Seed Cortical Mesh
function initCortex(count = 110) {
  neurons = [];
  synapses = [];
  actionPotentials = [];

  for (let i = 0; i < count; i++) {
    neurons.push(new Neuron());
  }

  // Connect local neighbors (Small-world cortical architecture)
  const maxConnectionDist = 170;
  for (let i = 0; i < neurons.length; i++) {
    const na = neurons[i];
    for (let j = 0; j < neurons.length; j++) {
      if (i === j) continue;
      const nb = neurons[j];
      const dist = Math.hypot(na.x - nb.x, na.y - nb.y);

      if (dist < maxConnectionDist && Math.random() < 0.28) {
        const syn = new Synapse(na, nb);
        na.synapses.push(syn);
        synapses.push(syn);
      }
    }
  }

  neuronCountEl.textContent = neurons.length;
}

// Draw EEG Rhythm Waveform
function updateEEG() {
  // Aggregate network membrane potential
  let totalV = 0;
  for (let n of neurons) totalV += n.voltage;
  const avgV = totalV / neurons.length;

  // Scale to mini-canvas
  const normalizedY = 16 - ((avgV + 60) / 45) * 12;
  eegBuffer.push(Math.max(2, Math.min(30, normalizedY)));
  if (eegBuffer.length > EEG_BUFFER_SIZE) eegBuffer.shift();

  // Clear & Draw mini-trace
  eegCtx.fillStyle = "#020306";
  eegCtx.fillRect(0, 0, eegCanvas.width, eegCanvas.height);

  eegCtx.strokeStyle = "#38bdf8";
  eegCtx.lineWidth = 1.4;
  eegCtx.beginPath();
  for (let i = 0; i < eegBuffer.length; i++) {
    const x = (i / EEG_BUFFER_SIZE) * eegCanvas.width;
    const y = eegBuffer[i];
    if (i === 0) eegCtx.moveTo(x, y);
    else eegCtx.lineTo(x, y);
  }
  eegCtx.stroke();
}

// Main 60 FPS Render Loop
function animate() {
  // Phosphor motion blur trail
  ctx.fillStyle = "rgba(3, 4, 8, 0.32)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Synaptic Axon Connections
  for (let s of synapses) s.draw();

  // 2. Update & Draw Action Potential Pulses
  for (let i = actionPotentials.length - 1; i >= 0; i--) {
    const ap = actionPotentials[i];
    if (!ap.update()) {
      actionPotentials.splice(i, 1);
    } else {
      ap.draw();
    }
  }

  // 3. Update & Draw Somatic Cell Bodies
  for (let n of neurons) {
    n.update();
    n.draw();
  }

  // Calculate firing frequency (Hz)
  const now = performance.now();
  if (now - lastHzSampleTime >= 1000) {
    const hz = spikeCounter;
    hzCountEl.textContent = `${hz} Hz`;

    // EEG classification
    if (hz > 45) eegRhythmEl.textContent = "GAMMA (40+ Hz)";
    else if (hz > 25) eegRhythmEl.textContent = "BETA (20-30 Hz)";
    else if (hz > 8) eegRhythmEl.textContent = "ALPHA (8-12 Hz)";
    else eegRhythmEl.textContent = "DELTA (1-4 Hz)";

    spikeCounter = 0;
    lastHzSampleTime = now;
  }

  updateEEG();
  requestAnimationFrame(animate);
}

// User Interaction
let isInteracting = false;

function applyToolAt(x, y) {
  if (currentTool === "stim") {
    // Inject depolarizing current into neighboring soma
    for (let n of neurons) {
      if (Math.hypot(n.x - x, n.y - y) < 65) {
        n.receiveSpike(30);
      }
    }
  } else if (currentTool === "cut") {
    // Axotomy: Sever any axon crossed by cursor
    for (let s of synapses) {
      const distToLine = distToSegment({ x, y }, s.source, s.target);
      if (distToLine < 12) {
        s.isSevered = true;
      }
    }
  }
}

// Point to Line-Segment Shortest Distance Helper
function distToSegment(p, v, w) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

canvas.addEventListener("mousedown", (e) => {
  if (e.target.closest(".control-deck, .hud-top")) return;
  isInteracting = true;

  if (currentTool === "add") {
    const newNeuron = new Neuron(e.clientX, e.clientY);
    // Connect to closest 4 neurons
    const sorted = [...neurons].sort((a, b) => Math.hypot(a.x - e.clientX, a.y - e.clientY) - Math.hypot(b.x - e.clientX, b.y - e.clientY));
    for (let i = 0; i < Math.min(4, sorted.length); i++) {
      const syn = new Synapse(newNeuron, sorted[i]);
      newNeuron.synapses.push(syn);
      synapses.push(syn);
    }
    neurons.push(newNeuron);
    neuronCountEl.textContent = neurons.length;
    return;
  }

  applyToolAt(e.clientX, e.clientY);
});

window.addEventListener("mousemove", (e) => {
  if (isInteracting && currentTool !== "add") {
    applyToolAt(e.clientX, e.clientY);
  }
});

window.addEventListener("mouseup", () => isInteracting = false);

// Touch Support
canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    isInteracting = true;
    applyToolAt(t.clientX, t.clientY);
  }
});

window.addEventListener("touchmove", (e) => {
  if (isInteracting && e.touches.length === 1) {
    const t = e.touches[0];
    applyToolAt(t.clientX, t.clientY);
  }
});

window.addEventListener("touchend", () => isInteracting = false);

// UI Listeners
modButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentMod = btn.dataset.mod;
  });
});

toolButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    toolButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentTool = btn.dataset.tool;
  });
});

threshSlider.addEventListener("input", (e) => {
  thresholdVoltage = parseInt(e.target.value);
  threshVal.textContent = `${thresholdVoltage} mV`;
});

plasticitySlider.addEventListener("input", (e) => {
  plasticityFactor = parseFloat(e.target.value);
  plasticityVal.textContent = plasticityFactor > 1.2 ? "High" : plasticityFactor < 0.6 ? "Low" : "Normal";
});

cascadeBtn.addEventListener("click", () => {
  // Fire synchronized global depolarization wave
  for (let n of neurons) {
    if (Math.random() < 0.6) n.receiveSpike(40);
  }
});

reconnectBtn.addEventListener("click", () => initCortex(110));

// Kickoff Simulation
initCortex(110);
animate();