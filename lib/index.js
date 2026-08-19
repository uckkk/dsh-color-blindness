// dsh-color-blindness — 色盲模拟 + 色盲安全配色。纯 Node。
import { defineTool } from "@deepseek-ai/dsh-tools";

const name = "色盲模拟";
const inject = ["tools"];

// Viénot 1999 线性近似矩阵（sRGB 线性空间）。
const MATRICES = {
  protanopia: [[0.56667, 0.43333, 0], [0.55833, 0.44167, 0], [0, 0.24167, 0.75833]],
  deuteranopia: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
  tritanopia: [[0.95, 0.05, 0], [0, 0.43333, 0.56667], [0, 0.475, 0.525]],
};

const TYPES = [
  { id: "protanopia", name: "红色盲", en: "Protanopia", desc: "红色锥细胞缺失，红绿难分，红色变暗。" },
  { id: "deuteranopia", name: "绿色盲", en: "Deuteranopia", desc: "绿色锥细胞缺失，红绿难分（最常见）。" },
  { id: "tritanopia", name: "蓝色盲", en: "Tritanopia", desc: "蓝色锥细胞缺失，蓝黄难分（罕见）。" },
  { id: "achromatopsia", name: "全色盲", en: "Achromatopsia", desc: "完全无色觉，只能感知明暗。" },
];

// Okabe-Ito 色盲安全配色（对常见色觉缺陷均可区分）。
const OKABE_ITO = [
  { name: "橙色", hex: "#E69F00" },
  { name: "天蓝", hex: "#56B4E9" },
  { name: "蓝绿", hex: "#009E73" },
  { name: "黄色", hex: "#F0E442" },
  { name: "蓝色", hex: "#0072B2" },
  { name: "朱红", hex: "#D55E00" },
  { name: "红紫", hex: "#CC79A7" },
  { name: "黑色", hex: "#000000" },
];

function parseHex(input) {
  if (typeof input !== "string") throw new Error("颜色必须是 #RRGGBB 或 RRGGBB");
  let s = input.trim().replace(/^#/, "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(s)) throw new Error(`非法颜色：${input}`);
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
}

function toHex(rgb) {
  const h = (n) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, "0");
  return "#" + h(rgb[0]) + h(rgb[1]) + h(rgb[2]);
}

function applyMatrix(rgb, m) {
  return [
    m[0][0] * rgb[0] + m[0][1] * rgb[1] + m[0][2] * rgb[2],
    m[1][0] * rgb[0] + m[1][1] * rgb[1] + m[1][2] * rgb[2],
    m[2][0] * rgb[0] + m[2][1] * rgb[1] + m[2][2] * rgb[2],
  ];
}

function achromatopsia(rgb) {
  const g = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return [g, g, g];
}

function simulate(color, type) {
  const rgb = parseHex(color);
  if (type === "achromatopsia") return toHex(achromatopsia(rgb));
  const m = MATRICES[type];
  if (!m) throw new Error(`未知类型：${type}（可用 protanopia/deuteranopia/tritanopia/achromatopsia）`);
  return toHex(applyMatrix(rgb, m));
}

async function apply(ctx, _config) {
  ctx.tools.register(defineTool({
    name: "simulate_color_blindness",
    description: "模拟一个颜色在不同色觉障碍（红绿色盲/绿色盲/蓝色盲/全色盲）下的显示效果。用于检查配色是否对色盲用户可区分。`color` 传 hex，`type` 传类型（或 all 返回全部）。",
    parameters: {
      color: { type: "string", required: true, description: "颜色 hex，如 #E69F00。" },
      type: { type: "string", description: "色盲类型：protanopia/deuteranopia/tritanopia/achromatopsia 或 all，默认 all。" },
    },
    output: {
      schema: {
        type: "object", additionalProperties: false,
        properties: {
          color: { type: "string", required: true },
          simulations: { type: "array", required: true, items: { type: "object", additionalProperties: false, properties: { id: { type: "string", required: true }, name: { type: "string", required: true }, hex: { type: "string", required: true } } } },
        },
      },
      render: (_a, v) => [{ type: "text", text: `原色 ${v.color} 模拟：\n` + v.simulations.map((s) => `  ${s.name}：${s.hex}`).join("\n") }],
    },
    execute: async (args) => {
      const color = parseHex(args.color) && args.color;
      const type = args.type ?? "all";
      let sims;
      if (type === "all") {
        sims = TYPES.map((t) => ({ id: t.id, name: t.name, hex: simulate(color, t.id) }));
      } else {
        const t = TYPES.find((x) => x.id === type || x.name.includes(type));
        if (!t) throw new Error(`未知类型：${type}`);
        sims = [{ id: t.id, name: t.name, hex: simulate(color, t.id) }];
      }
      return { color, simulations: sims };
    },
  }));

  ctx.tools.register(defineTool({
    name: "color_blind_safe_palette",
    description: "返回 Okabe-Ito 色盲安全配色（8 色，对常见色觉缺陷均可区分），用于图表与数据可视化。",
    parameters: {},
    output: {
      schema: {
        type: "object", additionalProperties: false,
        properties: { palette: { type: "array", required: true, items: { type: "object", additionalProperties: false, properties: { name: { type: "string", required: true }, hex: { type: "string", required: true } } } } },
      },
      render: (_a, v) => [{ type: "text", text: "Okabe-Ito 色盲安全配色：\n" + v.palette.map((p) => `  ${p.name} ${p.hex}`).join("\n") }],
    },
    execute: async () => ({ palette: OKABE_ITO.map((p) => ({ ...p })) }),
  }));

  ctx.tools.register(defineTool({
    name: "color_blindness_types",
    description: "列出四种色觉障碍类型（红色盲/绿色盲/蓝色盲/全色盲）及说明。",
    parameters: {},
    output: {
      schema: {
        type: "object", additionalProperties: false,
        properties: { types: { type: "array", required: true, items: { type: "object", additionalProperties: false, properties: { id: { type: "string", required: true }, name: { type: "string", required: true }, en: { type: "string", required: true }, desc: { type: "string", required: true } } } } },
      },
      render: (_a, v) => [{ type: "text", text: v.types.map((t) => `- ${t.name}（${t.en}）：${t.desc}`).join("\n") }],
    },
    execute: async () => ({ types: TYPES.map((t) => ({ ...t })) }),
  }));
}

export { apply, inject, name };
