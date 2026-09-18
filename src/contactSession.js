const contactSessionKey = 'closets-warehouse-planner-contact';

const emptyContact = { firstName: '', lastName: '', email: '', phone: '' };

export function getPlannerContact() {
  if (typeof window === 'undefined') return { ...emptyContact };

  try {
    const contact = JSON.parse(window.sessionStorage.getItem(contactSessionKey) || 'null');
    if (!contact?.email) return { ...emptyContact };
    return { ...emptyContact, ...contact };
  } catch {
    return { ...emptyContact };
  }
}

export function hasPlannerContact() {
  return Boolean(getPlannerContact().email);
}

export function rememberPlannerContact(contact) {
  if (typeof window === 'undefined' || !contact?.email) return;

  try {
    window.sessionStorage.setItem(contactSessionKey, JSON.stringify({
      firstName: String(contact.firstName || '').trim(),
      lastName: String(contact.lastName || '').trim(),
      email: String(contact.email || '').trim(),
      phone: String(contact.phone || '').trim(),
    }));
  } catch {
    // A blocked session store should not prevent a plan from being saved.
  }
}
