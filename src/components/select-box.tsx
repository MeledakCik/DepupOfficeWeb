"use client";

import { Check, ChevronDown } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

type SelectProps<T> = {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function SelectField<T extends string | number>(props: SelectProps<T>) {
  return <div className="field-label"><span>{props.label}</span><SelectBox {...props} /></div>;
}

export function SelectBox<T extends string | number>({ label, value, options, onChange, placeholder = "Pilih…", disabled, className = "" }: SelectProps<T>) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ value: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.findIndex(([option]) => option === value);

  useLayoutEffect(() => {
    const button = trigger.current;
    const list = menu.current;
    if (!open || !button || !list) return;
    if (list.showPopover) list.showPopover();
    else list.removeAttribute("popover");
    let frame = 0;
    function position() {
      if (!button || !list) return;
      const rect = button.getBoundingClientRect();
      const { clientWidth, clientHeight } = document.documentElement;
      const width = Math.min(Math.max(rect.width, 170), clientWidth - 20);
      const below = clientHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const upwards = below < list.scrollHeight && above > below;
      Object.assign(list.style, {
        width: width + "px",
        left: Math.max(10, Math.min(rect.left, clientWidth - width - 10)) + "px",
        top: upwards ? "auto" : rect.bottom + 5 + "px",
        bottom: upwards ? clientHeight - rect.top + 5 + "px" : "auto",
        maxHeight: Math.max(44, Math.min(288, upwards ? above : below)) + "px",
      });
    }
    function update(event: Event) {
      if (event.target === list) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(position);
    }
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !list?.contains(event.target) && !button?.contains(event.target)) setOpen(false);
    }
    position();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { capture: true, passive: true });
    document.addEventListener("pointerdown", dismiss, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("pointerdown", dismiss, true);
      if (list.isConnected && list.hidePopover) list.hidePopover();
    };
  }, [open]);

  useLayoutEffect(() => {
    const list = menu.current;
    const option = list?.children.item(active) as HTMLElement | null | undefined;
    if (!list || !option) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }, [active, open]);

  function choose(index: number) {
    const item = options[index];
    setOpen(false);
    if (item && !trigger.current?.matches(":disabled")) {
      trigger.current?.focus({ preventScroll: true });
      onChange(item[0]);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      choose(active);
    } else if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const index = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
        : open ? active + (event.key === "ArrowDown" ? 1 : -1) : Math.max(0, selected);
      setActive(Math.max(0, Math.min(options.length - 1, index)));
      setOpen(true);
    } else if (event.key.length === 1 && event.key.trim() && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const key = event.key.toLocaleLowerCase("id");
      const prior = now - typeahead.current.time < 700 ? typeahead.current.value : "";
      const prefix = prior === key ? key : prior + key;
      typeahead.current = { value: prefix, time: now };
      const start = prior === key ? active + 1 : 0;
      for (let step = 0; step < options.length; step++) {
        const index = (start + step) % options.length;
        if (options[index][1].toLocaleLowerCase("id").startsWith(prefix)) {
          setActive(index);
          setOpen(true);
          break;
        }
      }
    }
  }

  return <>
    <button ref={trigger} type="button" role="combobox" className={`select-box ${className}`} aria-label={label}
      aria-expanded={open} aria-controls={open ? id : undefined} aria-activedescendant={open && options[active] ? id + "-" + active : undefined}
      disabled={disabled || !options.length} onKeyDown={onKeyDown} onBlur={() => setOpen(false)}
      onClick={() => { if (!open) setActive(Math.max(0, selected)); setOpen(!open); }}>
      <span title={options[selected]?.[1]}>{options[selected]?.[1] ?? placeholder}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div id={id} ref={menu} role="listbox" aria-label={label} popover="manual" className="select-box-options">
      {options.map(([option, text], index) => <div id={id + "-" + index} key={option} role="option"
        className={index === active ? "option-active" : undefined} aria-selected={index === selected}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
        <span>{text}</span>{index === selected && <Check size={16} aria-hidden="true" />}
      </div>)}
    </div>}
  </>;
}
