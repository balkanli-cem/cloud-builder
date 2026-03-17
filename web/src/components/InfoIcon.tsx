import { useState, useRef, useEffect } from 'react';

const iconStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1rem',
  height: '1rem',
  borderRadius: '50%',
  border: '1px solid #64748b',
  color: '#94a3b8',
  fontSize: '0.6875rem',
  fontWeight: 700,
  cursor: 'help',
  marginLeft: '0.25rem',
  verticalAlign: 'middle',
  flexShrink: 0,
};

const tooltipStyle: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
  bottom: 'calc(100% + 0.5rem)',
  maxWidth: '18rem',
  padding: '0.5rem 0.75rem',
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '6px',
  color: '#e2e8f0',
  fontSize: '0.8125rem',
  lineHeight: 1.4,
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  zIndex: 1000,
  pointerEvents: 'none',
};

const tooltipStyleBelow: React.CSSProperties = {
  ...tooltipStyle,
  bottom: 'auto',
  top: 'calc(100% + 0.5rem)',
};

type Props = {
  text: string;
  /** Place tooltip below the icon instead of above */
  placement?: 'above' | 'below';
};

export function InfoIcon({ text, placement = 'above' }: Props) {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible) return;
    const close = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener('mouseleave', close);
    document.addEventListener('click', close);
    return () => {
      document.removeEventListener('mouseleave', close);
      document.removeEventListener('click', close);
    };
  }, [visible]);

  return (
    <span
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onFocus={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onBlur={() => setVisible(false)}
    >
      <span
        role="img"
        aria-label="More information"
        title={text}
        style={iconStyle}
        tabIndex={0}
      >
        i
      </span>
      {visible && (
        <span
          role="tooltip"
          style={placement === 'below' ? tooltipStyleBelow : tooltipStyle}
        >
          {text}
        </span>
      )}
    </span>
  );
}
