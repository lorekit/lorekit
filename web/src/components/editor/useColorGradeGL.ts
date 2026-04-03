"use client";

import { useEffect, useRef, useCallback } from "react";
import type { ColorGradeSettings } from "./VideoPreview";

/**
 * WebGL hook that renders video frames through a color-grading shader
 * matching ffmpeg's colortemperature + eq + vignette pipeline.
 */

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_texcoord;
out vec2 v_texcoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texcoord = a_texcoord;
}`;

// Fragment shader matching ffmpeg's exact color grading pipeline:
// 1. colortemperature (vf_colortemperature.c) — Planckian locus white balance
// 2. eq (vf_eq.c) — contrast on Y, saturation on Cb/Cr in YCbCr space
// 3. vignette (vf_vignette.c) — cos()^4 with aspect-ratio-corrected distance
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texcoord;
out vec4 fragColor;

uniform sampler2D u_video;
uniform float u_temperature;  // Kelvin (3000-9000, neutral=6500)
uniform float u_saturation;   // 0-2, neutral=1
uniform float u_contrast;     // 0-2, neutral=1
uniform float u_vignette;     // 0-1, 0=none
uniform vec2 u_resolution;    // video width/height for aspect ratio

// Tanner Helland Kelvin-to-RGB — same constants as ffmpeg vf_colortemperature.c
vec3 kelvinToRGB(float kelvin) {
  float temp = kelvin / 100.0;
  vec3 color;
  color.r = temp <= 66.0 ? 1.0 : clamp(1.29294 * pow(temp - 60.0, -0.1332), 0.0, 1.0);
  color.g = temp <= 66.0 ? clamp(0.39008 * log(temp) - 0.63184, 0.0, 1.0)
                         : clamp(1.12989 * pow(temp - 60.0, -0.0755), 0.0, 1.0);
  color.b = temp >= 66.0 ? 1.0 : temp <= 19.0 ? 0.0
                         : clamp(0.54321 * log(temp - 10.0) - 1.19625, 0.0, 1.0);
  return color;
}

// BT.709 RGB to YCbCr (matching ffmpeg's internal conversion)
vec3 rgbToYCbCr(vec3 rgb) {
  float y  =  0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  float cb = -0.1146 * rgb.r - 0.3854 * rgb.g + 0.5000 * rgb.b;
  float cr =  0.5000 * rgb.r - 0.4542 * rgb.g - 0.0458 * rgb.b;
  return vec3(y, cb, cr);
}

// BT.709 YCbCr to RGB
vec3 ycbcrToRGB(vec3 ycbcr) {
  float r = ycbcr.x + 1.5748 * ycbcr.z;
  float g = ycbcr.x - 0.1873 * ycbcr.y - 0.4681 * ycbcr.z;
  float b = ycbcr.x + 1.8556 * ycbcr.y;
  return vec3(r, g, b);
}

void main() {
  vec4 texColor = texture(u_video, v_texcoord);
  vec3 color = texColor.rgb;

  // 1. Color temperature — relative shift from neutral (6500K)
  // ffmpeg applies: pixel *= kelvinRGB(target) / kelvinRGB(neutral)
  vec3 neutralWB = kelvinToRGB(6500.0);
  vec3 targetWB = kelvinToRGB(u_temperature);
  color *= targetWB / neutralWB;
  color = clamp(color, 0.0, 1.0);

  // 2-3. Contrast & Saturation in YCbCr space (matching ffmpeg eq filter)
  // ffmpeg eq: contrast scales Y around 0 (in 0-1 range, around 0.5)
  // ffmpeg eq: saturation scales Cb and Cr channels
  vec3 ycbcr = rgbToYCbCr(color);
  ycbcr.x = (ycbcr.x - 0.5) * u_contrast + 0.5; // contrast on luma only
  ycbcr.y *= u_saturation; // saturation on chroma Cb
  ycbcr.z *= u_saturation; // saturation on chroma Cr
  color = clamp(ycbcrToRGB(ycbcr), 0.0, 1.0);

  // 4. Vignette — matching ffmpeg vf_vignette.c
  // ffmpeg: d = sqrt((x-cx)^2 * (1+aspect^2) + (y-cy)^2 * (1+1/aspect^2)) / dmax
  // Then: factor = pow(cos(d * angle), 4)  [cos^2 applied twice in ffmpeg]
  // angle = PI * vignette_intensity (from our mapping)
  if (u_vignette > 0.0) {
    float aspect = u_resolution.x / u_resolution.y;
    vec2 center = v_texcoord - 0.5;
    // Aspect-ratio corrected distance (ffmpeg normalizes by diagonal)
    float dx = center.x * aspect;
    float dy = center.y;
    float d = sqrt(dx * dx + dy * dy);
    // Normalize so corner distance ≈ 1.0
    float dmax = sqrt(0.25 * aspect * aspect + 0.25);
    d = d / dmax;
    float angle = u_vignette * 3.14159;
    float vig = cos(min(d * angle, 1.5707963));
    vig = vig * vig * vig * vig; // cos^4 like ffmpeg (applies cos^2 twice)
    color *= vig;
  }

  fragColor = vec4(color, texColor.a);
}`;

interface UseColorGradeGLOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  colorGrade: ColorGradeSettings | null;
  enabled: boolean;
}

export function useColorGradeGL({ videoRef, canvasRef, colorGrade, enabled }: UseColorGradeGLOptions) {
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const rafRef = useRef<number>(0);
  const initedRef = useRef(false);

  // Initialize WebGL
  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || initedRef.current) return false;

    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, alpha: false });
    if (!gl) return false;

    // Compile shaders
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERTEX_SHADER);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAGMENT_SHADER);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error("Fragment shader error:", gl.getShaderInfoLog(fs));
      return false;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return false;
    }

    gl.useProgram(program);

    // Fullscreen quad
    const positions = new Float32Array([
      -1, -1,  0, 1,
       1, -1,  1, 1,
      -1,  1,  0, 0,
       1,  1,  1, 0,
    ]);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);

    const aTex = gl.getAttribLocation(program, "a_texcoord");
    gl.enableVertexAttribArray(aTex);
    gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 16, 8);

    // Texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Cache uniform locations
    uniformsRef.current = {
      u_temperature: gl.getUniformLocation(program, "u_temperature"),
      u_saturation: gl.getUniformLocation(program, "u_saturation"),
      u_contrast: gl.getUniformLocation(program, "u_contrast"),
      u_vignette: gl.getUniformLocation(program, "u_vignette"),
      u_resolution: gl.getUniformLocation(program, "u_resolution"),
    };

    glRef.current = gl;
    programRef.current = program;
    textureRef.current = texture;
    initedRef.current = true;
    return true;
  }, [canvasRef, videoRef]);

  // Render loop
  useEffect(() => {
    if (!enabled || !colorGrade) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const render = () => {
      const gl = glRef.current;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!gl || !video || !canvas) {
        // Try to init
        if (!initGL()) {
          rafRef.current = requestAnimationFrame(render);
          return;
        }
      }

      const glCtx = glRef.current!;
      const vid = videoRef.current!;
      const cvs = canvasRef.current!;

      // Match canvas size to video
      if (vid.videoWidth > 0 && (cvs.width !== vid.videoWidth || cvs.height !== vid.videoHeight)) {
        cvs.width = vid.videoWidth;
        cvs.height = vid.videoHeight;
        glCtx.viewport(0, 0, vid.videoWidth, vid.videoHeight);
      }

      // Upload video frame as texture
      if (vid.readyState >= 2) {
        glCtx.bindTexture(glCtx.TEXTURE_2D, textureRef.current);
        glCtx.texImage2D(glCtx.TEXTURE_2D, 0, glCtx.RGBA, glCtx.RGBA, glCtx.UNSIGNED_BYTE, vid);
      }

      // Set uniforms
      const u = uniformsRef.current;
      glCtx.uniform1f(u.u_temperature, colorGrade.temperature);
      glCtx.uniform1f(u.u_saturation, colorGrade.saturation);
      glCtx.uniform1f(u.u_contrast, colorGrade.contrast);
      glCtx.uniform1f(u.u_vignette, colorGrade.vignette);
      glCtx.uniform2f(u.u_resolution, vid.videoWidth || 1080, vid.videoHeight || 1920);

      // Draw
      glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [enabled, colorGrade, initGL, videoRef, canvasRef]);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      initedRef.current = false;
      glRef.current = null;
      programRef.current = null;
      textureRef.current = null;
    };
  }, []);
}
