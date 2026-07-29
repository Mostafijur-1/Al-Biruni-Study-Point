"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, GitCompareArrows, ShieldQuestion } from "lucide-react";

import {
  CONCEPT_VIEW_LABELS,
  getLabConcept,
  type ConceptView,
} from "@/lib/labs/concepts";
import type { LabInputValues, ScienceLabId } from "@/lib/labs/rules";
import { cn } from "@/lib/utils";

type VisualizerProps = {
  labId: ScienceLabId;
  values: LabInputValues;
  result: number;
};

type DrawState = VisualizerProps & {
  width: number;
  height: number;
  time: number;
  view: ConceptView;
};

const COLORS = {
  ink: "#e6f7ff",
  muted: "#8eb5c9",
  faint: "rgba(198, 237, 255, .15)",
  cyan: "#67e8f9",
  blue: "#60a5fa",
  emerald: "#6ee7b7",
  amber: "#fcd34d",
  orange: "#fb923c",
  rose: "#fda4af",
  violet: "#c4b5fd",
  red: "#fb7185",
};

const VIEW_ICONS = {
  mechanism: Eye,
  relationship: GitCompareArrows,
  misconception: ShieldQuestion,
};

export function LabConceptVisualizer({
  labId,
  values,
  result,
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<ConceptView>("mechanism");
  const concept = getLabConcept(labId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let visible = true;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const nextWidth = Math.max(320, Math.round(bounds.width));
      const nextHeight = Math.max(360, Math.round(bounds.height));
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      if (
        canvas.width !== Math.round(nextWidth * ratio) ||
        canvas.height !== Math.round(nextHeight * ratio)
      ) {
        canvas.width = Math.round(nextWidth * ratio);
        canvas.height = Math.round(nextHeight * ratio);
      }
      width = nextWidth;
      height = nextHeight;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const render = (milliseconds: number) => {
      if (visible) {
        resize();
        drawVisualization(context, {
          labId,
          values,
          result,
          width,
          height,
          time: reduceMotion ? 0.37 : milliseconds / 1000,
          view,
        });
      }
      if (!reduceMotion) animationFrame = requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(resize);
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (visible && reduceMotion) render(0);
      },
      { rootMargin: "120px" },
    );
    observer.observe(canvas);
    visibilityObserver.observe(canvas);
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      visibilityObserver.disconnect();
    };
  }, [labId, result, values, view]);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 text-white shadow-inner">
      <header className="border-b border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-2xs font-black uppercase tracking-[0.2em] text-cyan-300">
              NCTB ধারণা-ভিত্তিক ভিজ্যুয়ালাইজেশন
            </p>
            <h3 className="mt-1 text-base font-black text-white">
              {concept.question}
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              পাঠ্য ফোকাস: {concept.curriculumFocus}
            </p>
          </div>
          <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-2xs font-black text-cyan-200">
            LIVE MODEL
          </span>
        </div>
        <div
          className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-4 sm:gap-2"
          role="tablist"
          aria-label="ভিজ্যুয়াল ব্যাখ্যার ধরন"
        >
          {(Object.keys(CONCEPT_VIEW_LABELS) as ConceptView[]).map((item) => {
            const Icon = VIEW_ICONS[item];
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={view === item}
                onClick={() => setView(item)}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[9px] font-black leading-tight transition sm:min-h-12 sm:gap-1.5 sm:px-2 sm:text-xs",
                  view === item
                    ? "border-cyan-300 bg-cyan-300 text-slate-950"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                {CONCEPT_VIEW_LABELS[item]}
              </button>
            );
          })}
        </div>
      </header>

      <div>
        <canvas
          ref={canvasRef}
          className="block h-[390px] w-full touch-pan-y sm:h-[430px]"
          role="img"
          aria-label={`${concept.curriculumFocus} বিষয়ক চলমান ব্যাখ্যামূলক মডেল`}
        />
        <div className="border-t border-white/10 bg-slate-900 px-4 py-3 text-center text-xs font-bold leading-5 text-slate-200">
          {view === "mechanism"
            ? concept.mechanism
            : view === "relationship"
              ? concept.relationship
              : concept.misconception}
        </div>
      </div>

      <footer className="grid gap-3 border-t border-white/10 bg-white/[0.03] p-3 sm:p-4 md:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3">
          <p className="text-2xs font-black uppercase tracking-wider text-amber-300">
            কোথায় নজর দেবেন
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-amber-50">
            {concept.watchFor}
          </p>
        </div>
        <ol className="-mx-1 grid auto-cols-[minmax(220px,82%)] grid-flow-col gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:auto-cols-[minmax(220px,48%)] md:mx-0 md:grid-flow-row md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
          {concept.steps.map((step, index) => (
            <li
              key={step}
              className="flex gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold leading-5 text-slate-200"
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-cyan-300 text-2xs font-black text-slate-950">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </footer>
    </section>
  );
}

function drawVisualization(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, height } = state;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#07182d");
  gradient.addColorStop(0.52, "#0b2440");
  gradient.addColorStop(1, "#07131f");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  drawGrid(context, width, height);

  switch (state.labId) {
    case "motion":
      drawMotion(context, state);
      break;
    case "force":
      drawForce(context, state);
      break;
    case "energy":
      drawEnergy(context, state);
      break;
    case "pressure":
      drawPressure(context, state);
      break;
    case "wave":
      drawWave(context, state);
      break;
    case "circuit":
      drawCircuit(context, state);
      break;
    case "optics":
      drawOptics(context, state);
      break;
    case "atom":
      drawAtom(context, state);
      break;
    case "mole":
      drawMole(context, state);
      break;
    case "reaction":
      drawReaction(context, state);
      break;
    case "ph":
      drawPh(context, state);
      break;
    case "solution":
      drawSolution(context, state);
      break;
    case "vector":
      drawVector(context, state);
      break;
    case "trigonometry":
      drawTrigonometry(context, state);
      break;
    case "probability":
      drawProbability(context, state);
      break;
    case "binary":
      drawBinary(context, state);
      break;
    case "logic":
      drawLogic(context, state);
      break;
    case "network":
      drawNetwork(context, state);
      break;
  }
}

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  context.save();
  context.strokeStyle = "rgba(126, 211, 255, .055)";
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += 32) {
    line(context, x, 0, x, height);
  }
  for (let y = 0; y <= height; y += 32) {
    line(context, 0, y, width, y);
  }
  context.restore();
}

function drawMotion(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, time, values, view } = state;
  const velocity = values.velocity ?? 1;
  const duration = values.time ?? 1;
  const left = 45;
  const right = width - 35;
  const trackY = 135;
  const phase = (time * 0.35) % 1;
  const position = left + (right - left) * phase;

  label(context, "সমান সময় ব্যবধানে অবস্থান", left, 42, COLORS.ink, 14);
  line(context, left, trackY, right, trackY, COLORS.faint, 5);
  const marks = 6;
  for (let index = 0; index <= marks; index += 1) {
    const progress = index / marks;
    const x = left + (right - left) * progress;
    dot(context, x, trackY, index === Math.round(phase * marks) ? 8 : 4, index === Math.round(phase * marks) ? COLORS.amber : COLORS.cyan);
    label(context, `${Math.round(progress * duration)}s`, x, trackY + 25, COLORS.muted, 10, "center");
  }
  roundedBox(context, position - 18, trackY - 35, 36, 28, COLORS.blue, 8);
  arrow(context, position, trackY - 48, Math.min(right, position + 35 + velocity * 2), trackY - 48, COLORS.amber, 3);
  label(context, "v", Math.min(right - 5, position + 48), trackY - 54, COLORS.amber, 12, "center");

  const graphLeft = 55;
  const graphTop = 205;
  const graphWidth = width - 100;
  const graphHeight = 120;
  drawAxes(context, graphLeft, graphTop + graphHeight, graphWidth, graphHeight, "সময়", "অবস্থান");
  const slope = Math.min(1, velocity / 20);
  line(
    context,
    graphLeft,
    graphTop + graphHeight,
    graphLeft + graphWidth * 0.88,
    graphTop + graphHeight - graphHeight * (0.2 + slope * 0.72),
    view === "misconception" ? COLORS.rose : COLORS.emerald,
    4,
  );
  label(
    context,
    view === "misconception"
      ? "রেখার উচ্চতা নয়—ঢালই বেগ"
      : `ঢাল = ${velocity} m/s`,
    graphLeft + graphWidth * 0.55,
    graphTop + 24,
    view === "misconception" ? COLORS.rose : COLORS.emerald,
    12,
    "center",
  );
}

function drawForce(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, view, time } = state;
  const mass = values.mass ?? 1;
  const acceleration = values.acceleration ?? 1;
  const force = mass * acceleration;
  const centerX = width * 0.42;
  const baseY = 205;
  const blockSize = 46 + mass * 2.4;
  const shift = Math.sin(time * 2.2) * Math.min(14, acceleration * 1.5);

  label(context, "মুক্ত-বস্তু চিত্র", 35, 38, COLORS.ink, 14);
  line(context, 25, baseY + blockSize / 2 + 4, width - 25, baseY + blockSize / 2 + 4, COLORS.faint, 3);
  roundedBox(context, centerX - blockSize / 2 + shift, baseY - blockSize / 2, blockSize, blockSize, COLORS.blue, 10);
  label(context, `${mass} kg`, centerX + shift, baseY + 4, "#06192a", 13, "center");
  arrow(context, centerX + blockSize / 2 + shift, baseY, centerX + blockSize / 2 + shift + Math.min(125, 35 + force * 2), baseY, COLORS.amber, 4);
  label(context, `F = ${force} N`, Math.min(width - 65, centerX + blockSize + 45), baseY - 13, COLORS.amber, 12, "center");
  arrow(context, centerX + shift, baseY - blockSize / 2, centerX + shift, baseY - blockSize / 2 - 58, COLORS.emerald, 3);
  arrow(context, centerX + shift, baseY + blockSize / 2, centerX + shift, baseY + blockSize / 2 + 48, COLORS.rose, 3);
  label(context, "N", centerX + 10 + shift, baseY - blockSize / 2 - 42, COLORS.emerald, 11);
  label(context, "W", centerX + 10 + shift, baseY + blockSize / 2 + 42, COLORS.rose, 11);

  const panelX = Math.max(width * 0.68, width - 185);
  roundedOutline(context, panelX, 62, width - panelX - 20, 245, COLORS.faint, 14);
  label(context, view === "relationship" ? "একই বল, দ্বিগুণ ভর" : view === "misconception" ? "বল ≠ বেগ" : "নিট বল → ত্বরণ", panelX + 16, 90, COLORS.cyan, 12);
  const compareMass = view === "relationship" ? mass * 2 : mass;
  const compareAcceleration = force / compareMass;
  roundedBox(context, panelX + 24, 145, 44 + compareMass * 2, 42, COLORS.violet, 8);
  arrow(context, panelX + 25, 222, panelX + 25 + Math.min(105, acceleration * 10), 222, COLORS.cyan, 3);
  label(context, `a = ${format(compareAcceleration)} m/s²`, panelX + 16, 256, COLORS.ink, 11);
  label(context, view === "misconception" ? "নিট বল 0 হলেও v থাকতে পারে" : "ভর বাড়লে a কমে", panelX + 16, 286, COLORS.muted, 10);
}

function drawEnergy(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, view, time } = state;
  const mass = values.mass ?? 1;
  const velocity = values.velocity ?? 1;
  const energy = 0.5 * mass * velocity ** 2;
  const leftWidth = width * 0.54;
  const carX = 55 + ((time * velocity * 11) % Math.max(90, leftWidth - 110));

  label(context, "কাজ → গতিশক্তি সঞ্চার", 35, 40, COLORS.ink, 14);
  line(context, 35, 185, leftWidth, 185, COLORS.faint, 5);
  roundedBox(context, carX, 145, 54, 32, COLORS.orange, 9);
  dot(context, carX + 13, 181, 7, "#111827");
  dot(context, carX + 42, 181, 7, "#111827");
  arrow(context, carX - 36, 160, carX - 4, 160, COLORS.amber, 4);
  label(context, `${velocity} m/s`, carX + 28, 130, COLORS.cyan, 11, "center");

  const barX = 45;
  const barY = 235;
  const maxBar = Math.max(80, leftWidth - 95);
  const energyRatio = Math.min(1, energy / 500);
  label(context, "শক্তি-বার", barX, barY - 12, COLORS.muted, 11);
  roundedBox(context, barX, barY, maxBar, 28, "rgba(255,255,255,.08)", 6);
  roundedBox(context, barX, barY, maxBar * energyRatio, 28, COLORS.emerald, 6);
  label(context, `${format(energy)} J`, barX + maxBar / 2, barY + 19, "#06192a", 11, "center");

  const graphX = leftWidth + 30;
  const graphY = 285;
  const graphWidth = width - graphX - 28;
  const graphHeight = 190;
  drawAxes(context, graphX, graphY, graphWidth, graphHeight, "বেগ", "Eₖ");
  context.beginPath();
  for (let index = 0; index <= 40; index += 1) {
    const progress = index / 40;
    const x = graphX + progress * graphWidth;
    const y = graphY - progress ** 2 * graphHeight * 0.88;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = view === "misconception" ? COLORS.rose : COLORS.cyan;
  context.lineWidth = 3;
  context.stroke();
  const pointProgress = Math.min(1, velocity / 10);
  dot(context, graphX + pointProgress * graphWidth, graphY - pointProgress ** 2 * graphHeight * 0.88, 6, COLORS.amber);
  label(context, view === "misconception" ? "v দ্বিগুণ → E চার গুণ" : "E ∝ v²", graphX + graphWidth / 2, 64, view === "misconception" ? COLORS.rose : COLORS.cyan, 12, "center");
}

function drawPressure(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, view } = state;
  const force = values.force ?? 20;
  const area = values.area ?? 1;
  const pressure = force / area;
  const baseY = 275;
  const currentWidth = 35 + area * 11;
  const compareWidth = Math.min(145, currentWidth * 1.7);
  const centers = [width * 0.3, width * 0.72];

  label(context, "একই বল, ভিন্ন সংস্পর্শ ক্ষেত্র", 35, 42, COLORS.ink, 14);
  [currentWidth, compareWidth].forEach((blockWidth, panel) => {
    const center = centers[panel];
    const panelPressure = force / (panel === 0 ? area : area * 1.7);
    arrow(context, center, 68, center, 135, COLORS.amber, 4);
    label(context, `${force} N`, center + 10, 80, COLORS.amber, 11);
    roundedBox(context, center - blockWidth / 2, 140, blockWidth, 110, panel === 0 ? COLORS.blue : COLORS.violet, 8);
    line(context, center - 90, baseY, center + 90, baseY, COLORS.faint, 5);
    const dots = Math.max(4, Math.min(22, Math.round(panelPressure / 2)));
    for (let index = 0; index < dots; index += 1) {
      const x = center - blockWidth / 2 + 5 + ((index * 17) % Math.max(8, blockWidth - 10));
      dot(context, x, baseY - 14 - (index % 3) * 8, 2.5, COLORS.rose);
    }
    label(context, panel === 0 ? `${area} m²` : `${format(area * 1.7)} m²`, center, 302, COLORS.muted, 11, "center");
    label(context, `${format(panelPressure)} Pa`, center, 326, panel === 0 ? COLORS.cyan : COLORS.violet, 12, "center");
  });
  label(context, view === "misconception" ? "বল একই, চাপ একই নয়" : "বিন্দু যত ঘন, প্রতি একক ক্ষেত্রের বল তত বেশি", width / 2, 355, view === "misconception" ? COLORS.rose : COLORS.emerald, 11, "center");
  void pressure;
}

function drawWave(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, time, view } = state;
  const frequency = values.frequency ?? 1;
  const wavelength = values.wavelength ?? 1;
  const midY = 165;
  const left = 30;
  const graphWidth = width - 60;
  const amplitude = 68;
  const waveNumber = (Math.PI * 2) / Math.max(45, wavelength * 28);
  const phase = time * frequency * 2;

  label(context, "কণার কম্পন বনাম শক্তির অগ্রগতি", left, 38, COLORS.ink, 14);
  arrow(context, left + 10, 72, width - 35, 72, COLORS.amber, 3);
  label(context, "তরঙ্গ/শক্তি এগোয়", width / 2, 61, COLORS.amber, 11, "center");
  context.beginPath();
  for (let x = left; x <= left + graphWidth; x += 3) {
    const y = midY + Math.sin((x - left) * waveNumber - phase) * amplitude;
    if (x === left) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = COLORS.cyan;
  context.lineWidth = 3;
  context.stroke();
  line(context, left, midY, width - left, midY, COLORS.faint, 1);

  const particles = 24;
  const highlight = Math.floor(particles * 0.46);
  for (let index = 0; index < particles; index += 1) {
    const x = left + (index / (particles - 1)) * graphWidth;
    const y = midY + Math.sin((x - left) * waveNumber - phase) * amplitude;
    dot(context, x, y, index === highlight ? 7 : 3.5, index === highlight ? COLORS.rose : COLORS.ink);
    if (index === highlight) {
      arrow(context, x, midY - 30, x, midY + 30, COLORS.rose, 2);
    }
  }
  const lambdaPixels = Math.min(graphWidth * 0.55, wavelength * 28);
  line(context, left + 45, 275, left + 45 + lambdaPixels, 275, COLORS.emerald, 2);
  line(context, left + 45, 267, left + 45, 283, COLORS.emerald, 2);
  line(context, left + 45 + lambdaPixels, 267, left + 45 + lambdaPixels, 283, COLORS.emerald, 2);
  label(context, `λ = ${wavelength} m`, left + 45 + lambdaPixels / 2, 298, COLORS.emerald, 11, "center");
  label(context, view === "misconception" ? "লাল কণা ডানে যায় না—শুধু দোলে" : `f = ${frequency} Hz · v = ${format(frequency * wavelength)} m/s`, width / 2, 330, view === "misconception" ? COLORS.rose : COLORS.cyan, 12, "center");
}

function drawCircuit(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, time, view } = state;
  const voltage = values.voltage ?? 1;
  const resistance = values.resistance ?? 1;
  const current = voltage / resistance;
  const left = 65;
  const right = width - 65;
  const top = 82;
  const bottom = 280;
  const perimeter = 2 * (right - left) + 2 * (bottom - top);

  label(context, "ক্ষেত্রের সংকেত দ্রুত · ইলেকট্রন ড্রিফট ধীর", 35, 38, COLORS.ink, 14);
  context.strokeStyle = COLORS.cyan;
  context.lineWidth = 5;
  context.strokeRect(left, top, right - left, bottom - top);
  roundedBox(context, left - 18, 145, 36, 72, COLORS.amber, 5);
  label(context, "+", left, 166, "#171105", 15, "center");
  label(context, "−", left, 202, "#171105", 15, "center");
  const resistorWidth = Math.min(145, 55 + resistance * 4);
  roundedBox(context, width / 2 - resistorWidth / 2, top - 17, resistorWidth, 34, COLORS.orange, 7);
  label(context, `${resistance} Ω`, width / 2, top + 5, "#241204", 11, "center");

  const speed = Math.max(0.08, current * 0.2);
  for (let index = 0; index < 13; index += 1) {
    const distance = (time * speed * 45 + index * (perimeter / 13)) % perimeter;
    const point = pointOnRectangle(left, top, right, bottom, distance);
    dot(context, point.x, point.y, 4, COLORS.blue);
  }
  const pulse = ((time * 1.8) % 1) * (right - left);
  context.save();
  context.shadowColor = COLORS.amber;
  context.shadowBlur = 18;
  dot(context, left + pulse, bottom, 7, COLORS.amber);
  context.restore();

  const barX = width * 0.64;
  label(context, `I = ${format(current)} A`, barX, 320, COLORS.cyan, 13);
  label(context, `P = ${format(voltage * current)} W`, barX, 343, COLORS.amber, 11);
  label(context, view === "misconception" ? "নীল e⁻ ধীরে চলে; হলুদ শক্তি-পালস দ্রুত ছড়ায়" : "রোধে সংঘর্ষ → তাপ/আলো", 35, 343, view === "misconception" ? COLORS.rose : COLORS.emerald, 11);
}

function drawOptics(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, view } = state;
  const f = values.focalLength ?? 10;
  const u = values.objectDistance ?? 20;
  const lensX = width * 0.54;
  const axisY = 205;
  const scale = Math.min(7, (width * 0.43) / 42);
  const objectX = lensX - u * scale;
  const objectHeight = 76;
  const focalOffset = f * scale;
  const denominator = u - f;
  const imageDistance = denominator === 0 ? Number.POSITIVE_INFINITY : (f * u) / denominator;
  const real = imageDistance > 0 && Number.isFinite(imageDistance);
  const imageX = real
    ? Math.min(width - 30, lensX + imageDistance * scale)
    : Math.max(25, lensX + imageDistance * scale);
  const magnification = Number.isFinite(imageDistance) ? -imageDistance / u : -3;
  const imageHeight = Math.max(-130, Math.min(130, objectHeight * magnification));

  label(context, "দুটি প্রধান রশ্মি যেখানে মেলে, সেখানেই প্রতিচ্ছবি", 30, 38, COLORS.ink, 14);
  line(context, 20, axisY, width - 20, axisY, COLORS.faint, 2);
  context.save();
  context.strokeStyle = COLORS.cyan;
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(lensX, axisY, 17, 125, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
  [lensX - focalOffset, lensX + focalOffset].forEach((x, index) => {
    dot(context, x, axisY, 5, COLORS.amber);
    label(context, index === 0 ? "F₁" : "F₂", x, axisY + 22, COLORS.amber, 10, "center");
  });
  arrow(context, objectX, axisY, objectX, axisY - objectHeight, COLORS.emerald, 4);
  label(context, "বস্তু", objectX, axisY + 25, COLORS.emerald, 11, "center");

  const objectTopY = axisY - objectHeight;
  line(context, objectX, objectTopY, lensX, objectTopY, COLORS.rose, 2.5);
  const ray1EndY = objectTopY + ((width - 25 - lensX) / focalOffset) * objectHeight;
  line(context, lensX, objectTopY, width - 25, ray1EndY, COLORS.rose, 2.5);
  const centerSlope = (axisY - objectTopY) / (lensX - objectX);
  line(context, objectX, objectTopY, width - 25, objectTopY + (width - 25 - objectX) * centerSlope, COLORS.violet, 2.5);

  if (real) {
    arrow(context, imageX, axisY, imageX, axisY - imageHeight, COLORS.amber, 4);
    label(context, "বাস্তব, উল্টো", imageX, Math.min(335, axisY - imageHeight + 24), COLORS.amber, 11, "center");
  } else {
    context.setLineDash([7, 6]);
    line(context, lensX, objectTopY, imageX, axisY - imageHeight, COLORS.amber, 2);
    line(context, lensX, axisY, imageX, axisY - imageHeight, COLORS.amber, 2);
    context.setLineDash([]);
    arrow(context, imageX, axisY, imageX, axisY - imageHeight, COLORS.amber, 3);
    label(context, "কাল্পনিক, সোজা", imageX, 330, COLORS.amber, 11, "center");
  }
  label(context, view === "misconception" ? "একটি রশ্মি নয়—অসংখ্য রশ্মির ছেদ ছবি গড়ে" : `u=${u} cm · f=${f} cm · v=${format(imageDistance)} cm`, width / 2, 355, view === "misconception" ? COLORS.rose : COLORS.cyan, 11, "center");
}

function drawAtom(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, time, view } = state;
  const protons = Math.round(values.protons ?? 1);
  const neutrons = Math.round(values.neutrons ?? 0);
  const electrons = Math.round(values.electrons ?? 0);
  const centerX = width * 0.36;
  const centerY = 190;
  const shells = electrons <= 2 ? [electrons] : electrons <= 10 ? [2, electrons - 2] : [2, 8, electrons - 10];

  label(context, "Z, A ও চার্জ—তিনটি আলাদা পরিচয়", 30, 38, COLORS.ink, 14);
  shells.forEach((count, shellIndex) => {
    const radius = 58 + shellIndex * 38;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.strokeStyle = "rgba(103,232,249,.32)";
    context.lineWidth = 1.5;
    context.stroke();
    for (let index = 0; index < count; index += 1) {
      const angle = time * (0.35 + shellIndex * 0.08) + (index / Math.max(1, count)) * Math.PI * 2;
      dot(context, centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius, 5, COLORS.cyan);
    }
  });
  for (let index = 0; index < Math.min(24, protons + neutrons); index += 1) {
    const angle = index * 2.399;
    const radius = 8 + (index % 4) * 7;
    dot(context, centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius, 6, index < protons ? COLORS.rose : COLORS.violet);
  }

  const panelX = width * 0.66;
  [
    { label: "পারমাণবিক সংখ্যা Z", value: protons, color: COLORS.rose },
    { label: "ভরসংখ্যা A", value: protons + neutrons, color: COLORS.violet },
    { label: "নিট চার্জ", value: protons - electrons, color: COLORS.cyan },
  ].forEach((item, index) => {
    roundedOutline(context, panelX, 78 + index * 75, width - panelX - 24, 58, item.color, 10);
    label(context, item.label, panelX + 12, 99 + index * 75, COLORS.muted, 10);
    label(context, `${item.value > 0 && index === 2 ? "+" : ""}${item.value}`, width - 45, 115 + index * 75, item.color, 19, "center");
  });
  label(context, view === "misconception" ? "e⁻ বদলালে মৌল নয়, চার্জ বদলায়" : protons === electrons ? "নিরপেক্ষ পরমাণু" : protons > electrons ? "ধনাত্মক আয়ন" : "ঋণাত্মক আয়ন", width / 2, 355, view === "misconception" ? COLORS.rose : COLORS.emerald, 12, "center");
}

function drawMole(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, view } = state;
  const moles = values.moles ?? 1;
  const molarMass = values.molarMass ?? 18;
  const selectedName = molarMass === 18 ? "H₂O" : molarMass === 44 ? "CO₂" : "NaCl";
  const containers = [
    { x: width * 0.28, molarMass, name: selectedName, color: COLORS.cyan },
    { x: width * 0.7, molarMass: 18, name: "H₂O", color: COLORS.violet },
  ];

  label(context, "সমান কণা-প্যাকেট · ভিন্ন ভর", 30, 38, COLORS.ink, 14);
  containers.forEach((container) => {
    roundedOutline(context, container.x - 82, 82, 164, 175, container.color, 20);
    const symbolicParticles = Math.max(4, Math.min(18, Math.round(moles * 4)));
    for (let index = 0; index < symbolicParticles; index += 1) {
      const x = container.x - 60 + ((index * 29) % 120);
      const y = 110 + ((index * 41) % 115);
      dot(context, x, y, 7, container.color);
      dot(context, x + 7, y + 4, 3.5, COLORS.ink);
    }
    label(context, container.name, container.x, 104, COLORS.ink, 13, "center");
    label(context, `${moles} mol`, container.x, 283, COLORS.muted, 11, "center");
    roundedBox(context, container.x - 62, 300, 124, 35, "rgba(255,255,255,.1)", 8);
    label(context, `${format(moles * container.molarMass)} g`, container.x, 322, container.color, 13, "center");
  });
  label(context, "প্রতিটি পাত্রে একই প্রতীকী কণা-প্যাকেট", width / 2, 274, COLORS.amber, 10, "center");
  label(context, view === "misconception" ? "এক মোল ≠ এক গ্রাম" : "কণাসংখ্যা একই; কণার নিজস্ব ভর আলাদা", width / 2, 360, view === "misconception" ? COLORS.rose : COLORS.emerald, 11, "center");
}

function drawReaction(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, time, view } = state;
  const temperature = values.temperature ?? 20;
  const concentration = values.concentration ?? 1;
  const particleCount = Math.round(7 + concentration * 5);
  const chamberLeft = 30;
  const chamberTop = 68;
  const chamberWidth = width * 0.58;
  const chamberHeight = 230;

  label(context, "সংঘর্ষ ≠ কার্যকর সংঘর্ষ", 30, 38, COLORS.ink, 14);
  roundedOutline(context, chamberLeft, chamberTop, chamberWidth, chamberHeight, COLORS.faint, 15);
  for (let index = 0; index < particleCount; index += 1) {
    const speed = 0.25 + temperature / 55;
    const x = chamberLeft + 18 + pseudoPingPong(time * speed + index * 1.73) * (chamberWidth - 36);
    const y = chamberTop + 18 + pseudoPingPong(time * speed * 0.73 + index * 2.21) * (chamberHeight - 36);
    const effective = (index + Math.floor(time * speed)) % Math.max(3, 8 - Math.round(temperature / 20)) === 0;
    context.save();
    if (effective) {
      context.shadowColor = COLORS.amber;
      context.shadowBlur = 16;
    }
    dot(context, x, y, effective ? 7 : 5, index % 2 === 0 ? COLORS.rose : COLORS.cyan);
    context.restore();
  }
  label(context, "উজ্জ্বল = সক্রিয়ণ শক্তি পার", chamberLeft + chamberWidth / 2, chamberTop + chamberHeight + 22, COLORS.amber, 10, "center");

  const graphX = chamberLeft + chamberWidth + 25;
  const graphBottom = 292;
  const graphWidth = width - graphX - 25;
  const graphHeight = 185;
  drawAxes(context, graphX, graphBottom, graphWidth, graphHeight, "শক্তি", "কণা");
  const peakShift = Math.min(0.5, temperature / 160);
  context.beginPath();
  for (let index = 0; index <= 40; index += 1) {
    const p = index / 40;
    const curve = Math.exp(-((p - (0.25 + peakShift)) ** 2) / 0.035) * 0.88;
    const x = graphX + p * graphWidth;
    const y = graphBottom - curve * graphHeight;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = COLORS.violet;
  context.lineWidth = 3;
  context.stroke();
  const thresholdX = graphX + graphWidth * 0.68;
  line(context, thresholdX, graphBottom, thresholdX, graphBottom - graphHeight, COLORS.amber, 2);
  label(context, "Eₐ", thresholdX, 89, COLORS.amber, 11, "center");
  label(context, view === "misconception" ? "তাপ → Eₐ পার হওয়া অংশ বাড়ে" : `${temperature}°C · ঘনমাত্রা ${concentration} M`, width / 2, 355, view === "misconception" ? COLORS.rose : COLORS.cyan, 11, "center");
}

function drawPh(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, view } = state;
  const ph = Math.round(values.phValue ?? 7);
  const left = 45;
  const scaleWidth = width - 90;

  label(context, "pH স্কেল সরল দেখায়, কিন্তু ভেতরে 10× ধাপ", 30, 38, COLORS.ink, 14);
  const gradient = context.createLinearGradient(left, 0, left + scaleWidth, 0);
  gradient.addColorStop(0, "#ef4444");
  gradient.addColorStop(0.45, "#facc15");
  gradient.addColorStop(0.5, "#22c55e");
  gradient.addColorStop(1, "#6366f1");
  roundedBox(context, left, 88, scaleWidth, 34, gradient, 10);
  for (let index = 1; index <= 14; index += 1) {
    const x = left + ((index - 1) / 13) * scaleWidth;
    line(context, x, 82, x, 128, "rgba(255,255,255,.65)", 1);
    label(context, `${index}`, x, 145, COLORS.muted, 9, "center");
  }
  const markerX = left + ((ph - 1) / 13) * scaleWidth;
  arrow(context, markerX, 65, markerX, 84, COLORS.ink, 3);
  label(context, `pH ${ph}`, markerX, 57, COLORS.ink, 12, "center");

  const samples = [Math.max(1, ph - 1), ph, Math.min(14, ph + 1)];
  samples.forEach((sample, index) => {
    const centerX = width * (0.25 + index * 0.25);
    const relativeExponent = ph - sample;
    const dots = relativeExponent > 0 ? 24 : relativeExponent < 0 ? 3 : 10;
    roundedOutline(context, centerX - 55, 190, 110, 112, index === 1 ? COLORS.cyan : COLORS.faint, 12);
    for (let dotIndex = 0; dotIndex < dots; dotIndex += 1) {
      dot(context, centerX - 40 + ((dotIndex * 19) % 80), 215 + ((dotIndex * 23) % 62), 3, COLORS.rose);
    }
    label(context, `pH ${sample}`, centerX, 323, index === 1 ? COLORS.cyan : COLORS.muted, 11, "center");
    label(context, `H⁺ ≈ 10⁻${sample}`, centerX, 340, COLORS.rose, 9, "center");
  });
  label(context, view === "misconception" ? "২ pH ধাপ = H⁺ একশ গুণ" : "প্রতিটি বাম ধাপে H⁺ দশ গুণ", width / 2, 365, view === "misconception" ? COLORS.rose : COLORS.emerald, 11, "center");
}

function drawSolution(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, view, time } = state;
  const moles = values.moles ?? 0.5;
  const volume = values.volume ?? 1;
  const particles = Math.max(4, Math.round(moles * 12));
  const beakers = [
    { x: width * 0.3, volume, label: "বর্তমান দ্রবণ", color: COLORS.cyan },
    { x: width * 0.7, volume: Math.min(2, volume * 1.7), label: "পানি যোগের পর", color: COLORS.violet },
  ];

  label(context, "কণা একই · আয়তন বড় · ঘনমাত্রা কম", 30, 38, COLORS.ink, 14);
  beakers.forEach((beaker, beakerIndex) => {
    const liquidHeight = 70 + beaker.volume * 76;
    const topY = 292 - liquidHeight;
    roundedOutline(context, beaker.x - 82, 80, 164, 220, COLORS.faint, 18);
    context.fillStyle = beakerIndex === 0 ? "rgba(34,211,238,.22)" : "rgba(196,181,253,.18)";
    context.fillRect(beaker.x - 78, topY, 156, 208 - topY + 84);
    for (let index = 0; index < particles; index += 1) {
      const availableHeight = Math.max(35, liquidHeight - 24);
      const x = beaker.x - 62 + ((index * 31 + Math.sin(time + index) * 5) % 124);
      const y = 276 - ((index * 37) % availableHeight);
      dot(context, x, y, 5, beaker.color);
    }
    label(context, beaker.label, beaker.x, 320, beaker.color, 11, "center");
    label(context, `${format(moles / beaker.volume)} M`, beaker.x, 342, COLORS.ink, 13, "center");
  });
  arrow(context, width * 0.43, 175, width * 0.55, 175, COLORS.amber, 3);
  label(context, "+ H₂O", width / 2, 160, COLORS.amber, 10, "center");
  label(context, view === "misconception" ? "দ্রব কণা হারায়নি—শুধু ছড়িয়ে গেছে" : `${moles} mol উভয় পাত্রেই অপরিবর্তিত`, width / 2, 368, view === "misconception" ? COLORS.rose : COLORS.emerald, 11, "center");
}

function drawVector(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, view } = state;
  const xValue = values.x ?? 0;
  const yValue = values.y ?? 0;
  const magnitude = Math.hypot(xValue, yValue);
  const originX = 70;
  const originY = 300;
  const scale = Math.min(24, (width - 145) / 12);
  const endX = originX + xValue * scale;
  const endY = originY - yValue * scale;

  label(context, "উপাংশ → মাথা-থেকে-লেজ → ফলন্ত", 30, 38, COLORS.ink, 14);
  drawAxes(context, originX, originY, width - 120, 235, "x", "y");
  context.setLineDash([6, 5]);
  line(context, originX, originY, endX, originY, COLORS.blue, 2);
  line(context, endX, originY, endX, endY, COLORS.violet, 2);
  context.setLineDash([]);
  arrow(context, originX, originY, endX, originY, COLORS.blue, 3);
  arrow(context, endX, originY, endX, endY, COLORS.violet, 3);
  arrow(context, originX, originY, endX, endY, COLORS.amber, 4);
  label(context, `x = ${xValue}`, (originX + endX) / 2, originY + 24, COLORS.blue, 11, "center");
  label(context, `y = ${yValue}`, endX + 12, (originY + endY) / 2, COLORS.violet, 11);
  label(context, `|v| = ${format(magnitude)}`, (originX + endX) / 2 - 8, (originY + endY) / 2 - 10, COLORS.amber, 12, "center");
  const angle = Math.atan2(yValue, xValue || 0.0001) * (180 / Math.PI);
  context.beginPath();
  context.arc(originX, originY, 38, -angle * (Math.PI / 180), 0);
  context.strokeStyle = COLORS.emerald;
  context.lineWidth = 2;
  context.stroke();
  label(context, `θ=${format(angle)}°`, originX + 52, originY - 10, COLORS.emerald, 10);
  label(context, view === "misconception" ? "|v| সাধারণভাবে x+y নয়" : "লম্ব উপাংশ দুটি স্বাধীন; অতিভুজ ফলন্ত", width / 2, 355, view === "misconception" ? COLORS.rose : COLORS.cyan, 11, "center");
}

function drawTrigonometry(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, time, view } = state;
  const amplitude = values.amplitude ?? 1;
  const frequency = values.frequency ?? 1;
  const radius = Math.min(76, 36 + amplitude * 8);
  const centerX = Math.min(135, width * 0.28);
  const centerY = 185;
  const angle = time * frequency;
  const pointX = centerX + Math.cos(angle) * radius;
  const pointY = centerY - Math.sin(angle) * radius;
  const graphLeft = centerX + radius + 45;
  const graphRight = width - 25;

  label(context, "বৃত্তের y-projection থেকে sine curve", 30, 38, COLORS.ink, 14);
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.strokeStyle = COLORS.faint;
  context.lineWidth = 2;
  context.stroke();
  line(context, centerX - radius - 15, centerY, centerX + radius + 15, centerY, COLORS.faint, 1);
  line(context, centerX, centerY - radius - 15, centerX, centerY + radius + 15, COLORS.faint, 1);
  line(context, centerX, centerY, pointX, pointY, COLORS.amber, 3);
  line(context, pointX, centerY, pointX, pointY, COLORS.violet, 2);
  dot(context, pointX, pointY, 7, COLORS.cyan);
  label(context, "y = A sin θ", centerX, centerY + radius + 35, COLORS.violet, 11, "center");

  drawAxes(context, graphLeft, centerY + radius, graphRight - graphLeft, radius * 2, "সময়", "y");
  context.beginPath();
  const graphWidth = graphRight - graphLeft;
  for (let index = 0; index <= 80; index += 1) {
    const p = index / 80;
    const x = graphLeft + p * graphWidth;
    const y = centerY - Math.sin(p * Math.PI * 4 * frequency) * radius;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = COLORS.cyan;
  context.lineWidth = 3;
  context.stroke();
  const projectedGraphX = graphLeft + ((angle / (Math.PI * 4 * frequency)) % 1) * graphWidth;
  line(context, pointX, pointY, projectedGraphX, pointY, COLORS.rose, 1.5);
  dot(context, projectedGraphX, pointY, 5, COLORS.rose);
  label(context, view === "misconception" ? "ঢেউটি বৃত্তীয় গতির ছায়া" : `A=${amplitude} · f=${frequency}`, width / 2, 340, view === "misconception" ? COLORS.rose : COLORS.emerald, 11, "center");
}

function drawProbability(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, time, view } = state;
  const favorable = Math.round(values.favorable ?? 1);
  const total = Math.max(favorable, Math.round(values.total ?? 2));
  const probability = favorable / total;
  const centerX = Math.min(135, width * 0.28);
  const centerY = 180;
  const radius = 92;
  const rotation = time * 0.8;

  label(context, "তাত্ত্বিক মান বনাম running frequency", 30, 38, COLORS.ink, 14);
  for (let index = 0; index < total; index += 1) {
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.arc(centerX, centerY, radius, (index / total) * Math.PI * 2 - Math.PI / 2, ((index + 1) / total) * Math.PI * 2 - Math.PI / 2);
    context.closePath();
    context.fillStyle = index < favorable ? COLORS.emerald : "rgba(255,255,255,.12)";
    context.fill();
    context.strokeStyle = "#0b2440";
    context.stroke();
  }
  context.save();
  context.translate(centerX, centerY);
  context.rotate(rotation);
  arrow(context, 0, 0, radius - 16, 0, COLORS.amber, 4);
  context.restore();
  dot(context, centerX, centerY, 8, COLORS.ink);
  label(context, `${favorable}/${total} = ${format(probability * 100)}%`, centerX, 306, COLORS.emerald, 12, "center");

  const graphX = centerX + radius + 45;
  const graphBottom = 292;
  const graphWidth = width - graphX - 28;
  const graphHeight = 200;
  drawAxes(context, graphX, graphBottom, graphWidth, graphHeight, "trial", "%");
  const targetY = graphBottom - probability * graphHeight;
  context.setLineDash([6, 5]);
  line(context, graphX, targetY, graphX + graphWidth, targetY, COLORS.amber, 2);
  context.setLineDash([]);
  label(context, "তাত্ত্বিক", graphX + graphWidth - 5, targetY - 8, COLORS.amber, 9, "right");
  context.beginPath();
  let successes = 0;
  const trials = 55;
  for (let index = 1; index <= trials; index += 1) {
    const random = seededRandom(index * 73 + total * 19 + favorable * 11);
    if (random < probability) successes += 1;
    const running = successes / index;
    const x = graphX + ((index - 1) / (trials - 1)) * graphWidth;
    const y = graphBottom - running * graphHeight;
    if (index === 1) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = COLORS.cyan;
  context.lineWidth = 2.5;
  context.stroke();
  label(context, view === "misconception" ? "আগের ফল পরের স্বাধীন trial বদলায় না" : "trial বাড়লে নীল রেখা স্থিতিশীল হয়", width / 2, 355, view === "misconception" ? COLORS.rose : COLORS.cyan, 11, "center");
}

function drawBinary(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, result, view, time } = state;
  const weights = [32, 16, 8, 4, 2, 1];
  const gap = 8;
  const cellWidth = Math.min(68, (width - 50 - gap * 5) / 6);
  const totalWidth = cellWidth * 6 + gap * 5;
  const startX = (width - totalWidth) / 2;

  label(context, "স্থানীয় মান: প্রতিটি ঘর বামের দিকে দ্বিগুণ", 30, 38, COLORS.ink, 14);
  weights.forEach((weight, index) => {
    const active = values[`bit${weight}`] === 1;
    const x = startX + index * (cellWidth + gap);
    roundedBox(context, x, 78, cellWidth, 105, active ? COLORS.cyan : "rgba(255,255,255,.08)", 10);
    label(context, active ? "1" : "0", x + cellWidth / 2, 119, active ? "#052333" : COLORS.muted, 24, "center");
    label(context, `2^${5 - index}`, x + cellWidth / 2, 148, active ? "#073047" : COLORS.muted, 10, "center");
    label(context, `${weight}`, x + cellWidth / 2, 169, active ? "#073047" : COLORS.muted, 11, "center");
    if (active) {
      const pulseY = 195 + ((time * 55 + index * 17) % 55);
      dot(context, x + cellWidth / 2, pulseY, 4, COLORS.amber);
      arrow(context, x + cellWidth / 2, 190, width / 2, 270, "rgba(252,211,77,.5)", 1.5);
    }
  });
  roundedOutline(context, width / 2 - 95, 270, 190, 58, COLORS.amber, 12);
  label(context, `যোগফল = ${format(result)}₁₀`, width / 2, 305, COLORS.amber, 18, "center");
  label(context, view === "misconception" ? `${weights.map((weight) => (values[`bit${weight}`] === 1 ? weight : 0)).filter(Boolean).join(" + ") || "0"} — অঙ্ক জোড়া নয়` : "অন বিটের ওজনগুলোই শুধু যোগ হয়", width / 2, 355, view === "misconception" ? COLORS.rose : COLORS.emerald, 11, "center");
}

function drawLogic(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, result, view, time } = state;
  const inputA = values.inputA === 1 ? 1 : 0;
  const inputB = values.inputB === 1 ? 1 : 0;
  const gateIndex = Math.round(values.gate ?? 0);
  const gate = ["AND", "OR", "XOR"][gateIndex] ?? "AND";
  const gateX = width * 0.47;
  const gateY = 150;

  label(context, "সংকেত পথ + সক্রিয় truth-table সারি", 30, 38, COLORS.ink, 14);
  [
    { value: inputA, y: 110, name: "A" },
    { value: inputB, y: 190, name: "B" },
  ].forEach((input) => {
    roundedBox(context, 45, input.y - 25, 55, 50, input.value ? COLORS.emerald : "rgba(255,255,255,.1)", 10);
    label(context, `${input.name}=${input.value}`, 72, input.y + 5, input.value ? "#05291f" : COLORS.muted, 12, "center");
    line(context, 100, input.y, gateX - 65, input.y, input.value ? COLORS.emerald : COLORS.faint, 4);
    if (input.value) {
      const pulseX = 105 + ((time * 60) % Math.max(20, gateX - 175));
      dot(context, pulseX, input.y, 5, COLORS.amber);
    }
  });
  roundedBox(context, gateX - 65, gateY - 70, 130, 140, COLORS.amber, 35);
  label(context, gate, gateX, gateY + 7, "#251803", 20, "center");
  line(context, gateX + 65, gateY, width * 0.7, gateY, result === 1 ? COLORS.cyan : COLORS.faint, 5);
  roundedBox(context, width * 0.7, gateY - 35, 68, 70, result === 1 ? COLORS.cyan : "rgba(255,255,255,.1)", 16);
  label(context, `${result}`, width * 0.7 + 34, gateY + 10, result === 1 ? "#052333" : COLORS.muted, 27, "center");

  const tableX = Math.max(width * 0.72, width - 150);
  label(context, gate === "XOR" ? "XOR truth table" : `${gate} truth table`, tableX, 238, COLORS.ink, 11);
  const rows = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  rows.forEach(([a, b], index) => {
    const output = gateIndex === 0 ? a & b : gateIndex === 1 ? a | b : a ^ b;
    const active = a === inputA && b === inputB;
    if (active) roundedBox(context, tableX - 5, 250 + index * 24, 118, 21, "rgba(103,232,249,.22)", 4);
    label(context, `${a}   ${b}   →   ${output}`, tableX + 5, 265 + index * 24, active ? COLORS.cyan : COLORS.muted, 10);
  });
  label(context, view === "misconception" ? "A=B=1 হলে OR=1, কিন্তু XOR=0" : "highlight সারিই বর্তমান ইনপুট", width / 2, 365, view === "misconception" ? COLORS.rose : COLORS.emerald, 11, "center");
}

function drawNetwork(context: CanvasRenderingContext2D, state: DrawState) {
  const { width, values, time, view, result } = state;
  const fileSize = values.fileSize ?? 20;
  const bandwidth = values.bandwidth ?? 10;
  const lanes = Math.max(1, Math.min(5, Math.round(bandwidth / 20)));
  const left = 70;
  const right = width - 70;
  const top = 95;
  const laneGap = 34;
  const packetCount = Math.max(8, Math.min(24, Math.round(fileSize / 8)));
  const speed = 42 + bandwidth * 0.45;

  label(context, "Bandwidth = প্রতি সেকেন্ডে কত বিট লিঙ্কে ঢোকে", 30, 38, COLORS.ink, 14);
  roundedBox(context, 22, top - 20, 62, lanes * laneGap + 26, COLORS.violet, 12);
  label(context, "FILE", 53, top + lanes * laneGap / 2 + 4, "#1c1231", 12, "center");
  roundedBox(context, right - 5, top - 20, 55, lanes * laneGap + 26, COLORS.emerald, 12);
  label(context, "RX", right + 23, top + lanes * laneGap / 2 + 4, "#05291f", 12, "center");
  for (let lane = 0; lane < lanes; lane += 1) {
    const y = top + lane * laneGap;
    line(context, left, y, right, y, "rgba(103,232,249,.25)", 8);
  }
  for (let index = 0; index < packetCount; index += 1) {
    const lane = index % lanes;
    const progress = ((time * speed + index * 42) % Math.max(60, right - left + 120)) - 60;
    const x = left + progress;
    if (x >= left - 15 && x <= right + 8) {
      roundedBox(context, x, top + lane * laneGap - 8, 24, 16, index % 3 === 0 ? COLORS.amber : COLORS.cyan, 4);
    }
  }
  for (let index = 0; index < Math.max(0, packetCount - lanes * 2); index += 1) {
    roundedBox(context, 31 + (index % 3) * 15, top + lanes * laneGap + 20 + Math.floor(index / 3) * 9, 11, 7, COLORS.muted, 2);
  }
  label(context, `${lanes}টি প্রতীকী lane · ${bandwidth} Mbps`, width / 2, top + lanes * laneGap + 52, COLORS.cyan, 11, "center");
  roundedOutline(context, width / 2 - 100, 295, 200, 45, COLORS.amber, 10);
  label(context, `শেষ packet: ${format(result)} s`, width / 2, 323, COLORS.amber, 14, "center");
  label(context, view === "misconception" ? "lane বাড়ে; packet-এর propagation speed নয়" : `${fileSize} MB ফাইল packet queue-তে ভাগ হয়েছে`, width / 2, 365, view === "misconception" ? COLORS.rose : COLORS.emerald, 11, "center");
}

function line(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = COLORS.ink,
  width = 1,
) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function arrow(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = COLORS.ink,
  width = 2,
) {
  line(context, x1, y1, x2, y2, color, width);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 8 + width;
  context.beginPath();
  context.moveTo(x2, y2);
  context.lineTo(
    x2 - Math.cos(angle - Math.PI / 6) * head,
    y2 - Math.sin(angle - Math.PI / 6) * head,
  );
  context.lineTo(
    x2 - Math.cos(angle + Math.PI / 6) * head,
    y2 - Math.sin(angle + Math.PI / 6) * head,
  );
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function dot(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
}

function roundedBox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string | CanvasGradient,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, Math.max(0, width), Math.max(0, height), radius);
  context.fillStyle = color;
  context.fill();
}

function roundedOutline(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, Math.max(0, width), Math.max(0, height), radius);
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  context.stroke();
}

function label(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = COLORS.ink,
  size = 12,
  align: CanvasTextAlign = "left",
) {
  context.fillStyle = color;
  context.font = `700 ${size}px "Noto Sans Bengali", "Nirmala UI", sans-serif`;
  context.textAlign = align;
  context.fillText(text, x, y);
}

function drawAxes(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  width: number,
  height: number,
  xLabel: string,
  yLabel: string,
) {
  arrow(context, originX, originY, originX + width, originY, COLORS.faint, 1.5);
  arrow(context, originX, originY, originX, originY - height, COLORS.faint, 1.5);
  label(context, xLabel, originX + width - 4, originY + 18, COLORS.muted, 9, "right");
  label(context, yLabel, originX + 5, originY - height + 12, COLORS.muted, 9);
}

function pointOnRectangle(
  left: number,
  top: number,
  right: number,
  bottom: number,
  distance: number,
) {
  const horizontal = right - left;
  const vertical = bottom - top;
  if (distance <= horizontal) return { x: left + distance, y: top };
  if (distance <= horizontal + vertical) {
    return { x: right, y: top + distance - horizontal };
  }
  if (distance <= horizontal * 2 + vertical) {
    return { x: right - (distance - horizontal - vertical), y: bottom };
  }
  return { x: left, y: bottom - (distance - horizontal * 2 - vertical) };
}

function pseudoPingPong(value: number) {
  const wrapped = ((value % 2) + 2) % 2;
  return wrapped <= 1 ? wrapped : 2 - wrapped;
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function format(value: number) {
  if (!Number.isFinite(value)) return "∞";
  return Number(value.toFixed(2)).toString();
}
