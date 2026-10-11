/** Trình dựng form đơn giản từ danh sách trường. */
export function Field({ f, value, onChange, disabled }) {
  const common = { value: value ?? '', disabled: disabled || f.readOnly, onChange: (e) => onChange(f.name, conv(f, e.target.value)) }
  let input
  if (f.options) {
    const opts = Array.isArray(f.options) ? f.options.map((o) => [o, o]) : Object.entries(f.options).map(([k, v]) => [k, typeof v === 'string' ? v : v.label])
    input = (
      <select {...common}>
        {f.optional && <option value="">—</option>}
        {opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    )
  } else if (f.type === 'textarea') input = <textarea rows={3} {...common} />
  else input = <input type={f.type === 'number' ? 'number' : f.type || 'text'} step="any" {...common} />
  return <label style={f.full ? { gridColumn: '1 / -1' } : null}>{f.label}{input}</label>
}

function conv(f, v) {
  if (f.type === 'number') return v === '' ? null : Number(v)
  if (f.optional && v === '') return null
  return v
}

export function Form({ fields, values, onChange, disabled }) {
  return (
    <div className="grid2">
      {fields.map((f) => <Field key={f.name} f={f} value={values[f.name]} onChange={onChange} disabled={disabled} />)}
    </div>
  )
}
