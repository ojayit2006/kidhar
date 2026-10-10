const CLOUDS = [
  { top: "10%", w: 340, h: 90, dur: 140, delay: -30 },
  { top: "34%", w: 460, h: 110, dur: 190, delay: -90 },
  { top: "58%", w: 300, h: 80, dur: 160, delay: -10 },
  { top: "80%", w: 520, h: 120, dur: 220, delay: -140 },
];

export default function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <div className="sun-rays" />
      <div className="sun-glow" />
      {CLOUDS.map((c, i) => (
        <div key={i} className="cloud" style={{ top: c.top, width: c.w, height: c.h, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }} />
      ))}
    </div>
  );
}
