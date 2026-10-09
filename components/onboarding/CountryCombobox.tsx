"use client"

import { forwardRef, useId, useMemo, useState } from "react"
import { findCountry, searchCountries } from "@/lib/countries"

// Country autocomplete (spec 6.3). Typing filters the list; a value only
// counts once it matches a known country or alias, and the derived region is
// shown underneath. Unknown names are never guessed into a region.

interface CountryComboboxProps {
  id?: string
  value: string
  onChange: (value: string) => void
  /** Called with the canonical country name when one is chosen or typed exactly. */
  onCommit?: (name: string) => void
  label?: string
  invalid?: boolean
  describedBy?: string
  className?: string
  inputClassName?: string
  placeholder?: string
  showRegion?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

const CountryCombobox = forwardRef<HTMLInputElement, CountryComboboxProps>(function CountryCombobox(
  {
    id,
    value,
    onChange,
    onCommit,
    label,
    invalid,
    describedBy,
    className = "",
    inputClassName = "",
    placeholder,
    showRegion = true,
    onKeyDown,
  },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? `country-${autoId}`
  const listId = `${inputId}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const matches = useMemo(() => searchCountries(value, 6), [value])
  const known = findCountry(value)
  const showList = open && matches.length > 0 && !(known && known.name === value)

  const choose = (name: string) => {
    onChange(name)
    onCommit?.(name)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showList) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActive(i => (i + 1) % matches.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActive(i => (i - 1 + matches.length) % matches.length)
        return
      }
      if (e.key === "Enter") {
        // Pick the highlighted country instead of submitting the form.
        e.preventDefault()
        choose(matches[active]?.name ?? value)
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
        return
      }
    } else if (e.key === "ArrowDown" && matches.length > 0) {
      e.preventDefault()
      setOpen(true)
      return
    }
    onKeyDown?.(e)
  }

  const handleBlur = () => {
    setOpen(false)
    // Typed an exact name or alias: settle on the canonical spelling.
    if (known) {
      if (known.name !== value) onChange(known.name)
      onCommit?.(known.name)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={ref}
        id={inputId}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={e => {
          onChange(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={inputClassName}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-lg border border-line bg-surface shadow-[0_8px_20px_rgba(27,35,48,0.08)]"
        >
          {matches.map((c, i) => (
            <li
              key={c.name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: keeps focus in the input so blur doesn't close first
              onMouseDown={e => {
                e.preventDefault()
                choose(c.name)
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2.5 text-sm text-ink ${i === active ? "bg-paper-sunk" : ""}`}
            >
              {c.name}
            </li>
          ))}
        </ul>
      )}
      {showRegion && known && <p className="mt-1 text-xs text-ink-3">{known.region}</p>}
    </div>
  )
})

export default CountryCombobox
