// Signature hero background: slow "molten gold veins on ink" field rendered with
// a single WebGL fragment shader (domain-warped fbm noise). Purposeful and on
// brand rather than a generic particle field.
//
// Progressive enhancement contract:
//  - If WebGL is unavailable, the CSS gradient on the canvas wrapper shows through.
//  - If the user prefers reduced motion, we render a single static frame.
//  - The animation pauses when the hero scrolls out of view (saves battery/CPU).

const FRAG = `
precision highp float;
uniform float u_time;
uniform vec2 u_res;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++){
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0) * 2.4;
  float t = u_time * 0.045;

  // Domain warping for organic, flowing filaments.
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  float f = fbm(p + 1.8 * q + t * 0.5);

  vec3 ink     = vec3(0.043, 0.043, 0.043);
  vec3 inkSoft = vec3(0.102, 0.094, 0.078);
  vec3 gold    = vec3(0.722, 0.584, 0.290);
  vec3 goldL   = vec3(0.910, 0.850, 0.710);

  vec3 col = mix(ink, inkSoft, smoothstep(0.15, 0.85, f));
  float veins = smoothstep(0.55, 0.72, f) - smoothstep(0.72, 0.93, f);
  col = mix(col, gold, veins * 0.55);
  col += goldL * pow(veins, 3.0) * 0.3;

  // Vignette to keep focus center/left where the text sits.
  float d = distance(uv, vec2(0.42, 0.5));
  col *= 1.0 - d * 0.7;

  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function initHero(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-hero-canvas]");
  if (!canvas) return;

  const gl =
    canvas.getContext("webgl", { antialias: true, alpha: false }) ||
    (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
  if (!gl) return; // CSS gradient fallback remains visible.

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  if (!prog) return;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, "u_time");
  const uRes = gl.getUniformLocation(prog, "u_res");

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const resize = () => {
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = performance.now();

  const draw = (now: number) => {
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  if (reduced) {
    draw(start + 6200); // a single, pleasant static frame
    return;
  }

  let running = true;
  let raf = 0;
  const loop = (now: number) => {
    if (!running) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  // Pause when the hero is off-screen.
  const io = new IntersectionObserver(
    ([entry]) => {
      running = entry.isIntersecting;
      if (running) raf = requestAnimationFrame(loop);
      else cancelAnimationFrame(raf);
    },
    { threshold: 0.02 },
  );
  io.observe(canvas);

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    running = false;
    cancelAnimationFrame(raf);
  });
}
