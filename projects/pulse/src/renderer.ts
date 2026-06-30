/**
 * WebGL renderer: a domain-warped gold field whose motion and brightness track
 * live throughput. The pure colour helpers are exported and unit-tested; the GL
 * plumbing degrades safely (no WebGL -> CSS background shows through; reduced
 * motion -> a single static frame).
 */

const FRAG = `
precision highp float;
uniform float u_time;
uniform vec2 u_res;
uniform float u_intensity; // 0..1 live throughput

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
  vec2 u=f*f*(3.0-2.0*f);
  return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
}
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.0; a*=0.5;} return v; }

void main(){
  vec2 uv=gl_FragCoord.xy/u_res.xy;
  vec2 p=(uv-0.5)*vec2(u_res.x/u_res.y,1.0)*3.0;
  float t=u_time*(0.05+0.25*u_intensity);
  vec2 q=vec2(fbm(p+t),fbm(p+vec2(3.1,1.7)-t));
  float f=fbm(p+2.0*q+t*0.5);
  vec3 ink=vec3(0.043);
  vec3 gold=vec3(0.722,0.584,0.290);
  vec3 goldL=vec3(0.910,0.850,0.710);
  float veins=smoothstep(0.5,0.7,f)-smoothstep(0.7,0.95,f);
  vec3 col=mix(ink, gold, veins*(0.4+0.6*u_intensity));
  col+=goldL*pow(veins,3.0)*(0.2+u_intensity);
  gl_FragColor=vec4(col,1.0);
}`;

const VERT = `attribute vec2 a_pos; void main(){ gl_Position=vec4(a_pos,0.0,1.0); }`;

/** Gold ramp used by the legend/fallback. Pure + tested. */
export function goldRamp(intensity: number): [number, number, number] {
  const i = Math.max(0, Math.min(1, intensity));
  const ink = [11, 11, 11];
  const gold = [184, 149, 74];
  return [0, 1, 2].map((c) => Math.round(ink[c]! + (gold[c]! - ink[c]!) * i)) as [number, number, number];
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
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

export interface FieldRenderer {
  setIntensity(v: number): void;
  dispose(): void;
}

/** Mount the GL field on a canvas. Returns null if WebGL is unavailable. */
export function mountField(canvas: HTMLCanvasElement, reducedMotion = false): FieldRenderer | null {
  const gl =
    canvas.getContext("webgl", { alpha: false, antialias: true }) ||
    (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, "u_time");
  const uRes = gl.getUniformLocation(prog, "u_res");
  const uInt = gl.getUniformLocation(prog, "u_intensity");

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let intensity = 0;
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

  const start = performance.now();
  let raf = 0;
  const draw = (now: number) => {
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform1f(uInt, intensity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  if (reducedMotion) {
    draw(start + 4000);
    return { setIntensity: (v) => (intensity = v), dispose: () => {} };
  }

  const loop = (now: number) => {
    draw(now);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    setIntensity: (v) => (intensity = v),
    dispose: () => cancelAnimationFrame(raf),
  };
}
