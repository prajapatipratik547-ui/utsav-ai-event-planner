import type { Ideas } from '../../../shared/types.js';
import type { PanelProps } from '../Dashboard.js';

const SECTIONS: { key: keyof Omit<Ideas, 'theme'>; title: string }[] = [
  { key: 'decor', title: 'Decor' },
  { key: 'menu', title: 'Menu' },
  { key: 'activities', title: 'Activities & moments' },
  { key: 'favors', title: 'Gifts & favours' },
  { key: 'tips', title: 'Planner’s tips' },
];

export function IdeasPanel({ saved }: PanelProps) {
  const { ideas, input, source } = saved.plan;
  const lang = input.language === 'hi' && source !== 'offline' ? 'hi' : undefined;

  return (
    <div className="stack" lang={lang}>
      <section className="card theme-card" aria-labelledby="ideas-theme-title">
        <p className="eyebrow">Your theme</p>
        <h2 id="ideas-theme-title" className="theme-name">
          {ideas.theme.name}
        </h2>
        <p style={{ maxWidth: '65ch' }}>{ideas.theme.description}</p>
        <ul className="palette" aria-label="Theme colour palette">
          {ideas.theme.palette.map((color) => (
            <li key={color} className="swatch">
              <span style={{ background: color }} aria-hidden="true" />
              <span>{color.toUpperCase()}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="panel-grid even">
        {SECTIONS.map(({ key, title }) => (
          <section key={key} className="card" aria-labelledby={`ideas-${key}`}>
            <h2 id={`ideas-${key}`}>{title}</h2>
            <ul className="idea-list">
              {ideas[key].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
