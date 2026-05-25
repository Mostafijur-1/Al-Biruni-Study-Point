export function formatPhoneDisplay(phone: string) {
  if (phone.length === 11 && phone.startsWith("01")) {
    return `${phone.slice(0, 5)}-${phone.slice(5, 9)}-${phone.slice(9)}`;
  }
  return phone;
}

export function phoneTelHref(phone: string) {
  return `tel:+88${phone}`;
}
