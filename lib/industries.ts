/** Fields people work in, used for "who viewed you" analytics. Chosen by each member in their profile. */
export const INDUSTRIES = [
  ['tech', 'Technology'], ['finance', 'Finance & investment'], ['realestate', 'Real estate'], ['marketing', 'Marketing & media'],
  ['sales', 'Sales & business development'], ['health', 'Health & medicine'], ['law', 'Law'], ['education', 'Education & research'],
  ['design', 'Design & creative'], ['retail', 'Retail & consumer'], ['hospitality', 'Hospitality & events'], ['manufacturing', 'Industry & manufacturing'],
  ['public', 'Government & public sector'], ['nonprofit', 'Nonprofit'], ['student', 'Student'], ['other', 'Other'],
] as const
export type Industry = (typeof INDUSTRIES)[number][0]
export const INDUSTRY_LABEL: Record<string, string> = Object.fromEntries(INDUSTRIES)
export const isIndustry = (v: unknown): v is Industry => INDUSTRIES.some(([k]) => k === v)
