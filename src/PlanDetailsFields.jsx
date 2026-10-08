export default function PlanDetailsFields({ customer, setCustomer, hasKnownContact, roomName, setRoomName }) {
  return <div className="mt-3 grid gap-2 sm:grid-cols-2">
    {!hasKnownContact && [
      ['firstName', 'First name', 'text', 'given-name'],
      ['lastName', 'Last name', 'text', 'family-name'],
      ['email', 'Email', 'email', 'email'],
      ['phone', 'Phone', 'tel', 'tel'],
    ].map(([key, label, type, autoComplete]) => <label key={key} className="grid gap-1 text-xs font-bold text-stone-600">
      {label}
      <input type={type} autoComplete={autoComplete} value={customer[key]} onChange={(event) => setCustomer((current) => ({ ...current, [key]: event.target.value }))} aria-label={label} className="rounded border border-stone-300 px-2 py-2 text-sm font-semibold" required />
    </label>)}
    <label className="grid gap-1 text-xs font-bold text-stone-600 sm:col-span-2">
      Room name
      <input type="text" value={roomName} onChange={(event) => setRoomName(event.target.value)} aria-label="Room name" placeholder="Example: Master Bedroom Closet" maxLength={120} pattern=".*\S.*" className="rounded border border-stone-300 px-2 py-2 text-sm font-semibold" required />
    </label>
  </div>;
}
