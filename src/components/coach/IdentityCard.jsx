const TONE_STYLES = {
  positive: { border: 'border-green/40', accent: 'text-green', label: 'You are' },
  neutral:  { border: 'border-blue/40',  accent: 'text-blue',  label: 'Right now' },
  honest:   { border: 'border-orange/40', accent: 'text-orange', label: 'Honest read' },
};

export default function IdentityCard({ sentence, tone = 'neutral' }) {
  const style = TONE_STYLES[tone] || TONE_STYLES.neutral;

  return (
    <div className="px-4">
      <div className={`bg-surface border ${style.border} rounded-2xl p-6`}>
        <p className={`text-xs font-medium uppercase tracking-wider mb-3 ${style.accent}`}>
          {style.label}
        </p>
        <p className="font-heading text-xl leading-snug text-text">
          {sentence}
        </p>
      </div>
    </div>
  );
}
