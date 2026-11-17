import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

type Option = { value: string; label: string; disabled?: boolean };

export function CompactSelect({
  label, name, options, value, defaultValue = '', placeholder = 'Choose…',
  required = false, disabled = false, onChange,
}: {
  label: string; name?: string; options: Option[]; value?: string; defaultValue?: string; placeholder?: string;
  required?: boolean; disabled?: boolean; onChange?: (value: string) => void;
}) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [local, setLocal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState(false);
  const choices = required || value !== undefined ? options : [{ value: '', label: placeholder }, ...options];
  const selected = choices.find(option => option.value === (value ?? local));
  const expanded = open && !disabled;

  useEffect(() => {
    if (!expanded) return;
    const picked = list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]:not(:disabled)');
    (picked ?? list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
    function closeOutside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [expanded]);

  function choose(next: string) {
    setLocal(next);
    setMissing(false);
    setOpen(false);
    onChange?.(next);
    trigger.current?.focus({ preventScroll: true });
  }

  function keys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
      return;
    }
    const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? Math.min(index + 1, buttons.length - 1) :
      event.key === 'ArrowUp' ? Math.max(index - 1, 0) : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : null;
    if (next !== null) {
      event.preventDefault();
      buttons[next]?.focus();
    }
  }

  return <div ref={container} className="compact-select" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <span id={id + '-label'} className="compact-select-label">{label}</span>
    <button ref={trigger} type="button" className="compact-select-trigger" aria-labelledby={id + '-label ' + id + '-value'}
      aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? id + '-options' : undefined}
      aria-invalid={missing || undefined} aria-describedby={missing ? id + '-error' : undefined}
      disabled={disabled} onClick={() => setOpen(!expanded)} onKeyDown={event => {
        if (event.key === 'ArrowDown' && !expanded) { event.preventDefault(); setOpen(true); }
      }}>
      <span id={id + '-value'}>{selected?.label ?? placeholder}</span><ChevronDown size={15} aria-hidden="true" />
    </button>
    {name && <input className="compact-select-input" type={required ? 'text' : 'hidden'} aria-hidden="true" tabIndex={-1}
      name={name} value={selected?.value ?? ''} onChange={() => {}} required={required} disabled={disabled}
      onInvalid={event => { event.preventDefault(); setMissing(true); trigger.current?.focus(); }} />}
    {expanded && <div id={id + '-options'} role="listbox" aria-labelledby={id + '-label'} ref={list}
      className="compact-select-options" onKeyDown={keys}>
      {choices.map(choice => <button type="button" role="option" key={choice.value}
        aria-selected={choice.value === selected?.value} disabled={choice.disabled} onClick={() => choose(choice.value)}>
        <span>{choice.label}</span>{choice.value === selected?.value && <Check size={15} aria-hidden="true" />}
      </button>)}
      {!choices.length && <p className="updated">No options available.</p>}
    </div>}
    {missing && <small id={id + '-error'} role="alert" className="compact-select-error">Choose an option.</small>}
  </div>;
}
