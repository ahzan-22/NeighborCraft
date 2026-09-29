export function mapsLink(lat?: number | null, lng?: number | null, address?: string | null): string {
  const q = lat != null && lng != null ? `${lat},${lng}` : (address ?? '');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function waLink(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('08')) digits = '62' + digits.slice(1);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
