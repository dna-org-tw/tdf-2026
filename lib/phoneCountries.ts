export interface PhoneCountry {
  code: string;
  dial: string;
  name: string;
}

/**
 * Curated list of dial codes for a Taiwan-based digital-nomad festival.
 * Taiwan is first (default); the rest alphabetical by English name.
 * Expand when a real user hits a missing country.
 */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'TW', dial: '+886', name: 'Taiwan' },
  { code: 'AR', dial: '+54', name: 'Argentina' },
  { code: 'AU', dial: '+61', name: 'Australia' },
  { code: 'AT', dial: '+43', name: 'Austria' },
  { code: 'BE', dial: '+32', name: 'Belgium' },
  { code: 'BR', dial: '+55', name: 'Brazil' },
  { code: 'CA', dial: '+1', name: 'Canada' },
  { code: 'CL', dial: '+56', name: 'Chile' },
  { code: 'CN', dial: '+86', name: 'China' },
  { code: 'CZ', dial: '+420', name: 'Czech Republic' },
  { code: 'DK', dial: '+45', name: 'Denmark' },
  { code: 'EG', dial: '+20', name: 'Egypt' },
  { code: 'FI', dial: '+358', name: 'Finland' },
  { code: 'FR', dial: '+33', name: 'France' },
  { code: 'DE', dial: '+49', name: 'Germany' },
  { code: 'GR', dial: '+30', name: 'Greece' },
  { code: 'HK', dial: '+852', name: 'Hong Kong' },
  { code: 'HU', dial: '+36', name: 'Hungary' },
  { code: 'IN', dial: '+91', name: 'India' },
  { code: 'ID', dial: '+62', name: 'Indonesia' },
  { code: 'IE', dial: '+353', name: 'Ireland' },
  { code: 'IL', dial: '+972', name: 'Israel' },
  { code: 'IT', dial: '+39', name: 'Italy' },
  { code: 'JP', dial: '+81', name: 'Japan' },
  { code: 'KR', dial: '+82', name: 'Korea, South' },
  { code: 'MO', dial: '+853', name: 'Macao' },
  { code: 'MY', dial: '+60', name: 'Malaysia' },
  { code: 'MX', dial: '+52', name: 'Mexico' },
  { code: 'NL', dial: '+31', name: 'Netherlands' },
  { code: 'NZ', dial: '+64', name: 'New Zealand' },
  { code: 'NO', dial: '+47', name: 'Norway' },
  { code: 'PH', dial: '+63', name: 'Philippines' },
  { code: 'PL', dial: '+48', name: 'Poland' },
  { code: 'PT', dial: '+351', name: 'Portugal' },
  { code: 'RO', dial: '+40', name: 'Romania' },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia' },
  { code: 'SG', dial: '+65', name: 'Singapore' },
  { code: 'ZA', dial: '+27', name: 'South Africa' },
  { code: 'ES', dial: '+34', name: 'Spain' },
  { code: 'SE', dial: '+46', name: 'Sweden' },
  { code: 'CH', dial: '+41', name: 'Switzerland' },
  { code: 'TH', dial: '+66', name: 'Thailand' },
  { code: 'TR', dial: '+90', name: 'Turkey' },
  { code: 'AE', dial: '+971', name: 'United Arab Emirates' },
  { code: 'GB', dial: '+44', name: 'United Kingdom' },
  { code: 'US', dial: '+1', name: 'United States' },
  { code: 'VN', dial: '+84', name: 'Vietnam' },
];
