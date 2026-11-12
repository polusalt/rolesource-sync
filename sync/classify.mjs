// Role family, seniority, advert sponsorship wording and agency signals.

// Order matters: first match wins. Each family is one browse page (/jobs/<slug>/).
// Patterns match from the start of a word (leading \b only, so "scien" matches "scientist");
// short tokens carry their own trailing \b so "qa" doesn't match "Qatar".
export const ROLE_FAMILIES = [
  ['data-scientist', 'Data scientist', /\b(data scien|machine learning|ml engineer|ai engineer|applied scien|research scien|deep learning|nlp\b|model validation|data science)/i],
  ['data-engineer', 'Data engineer', /\b(data engineer|analytics engineer|data platform|etl\b|big data)/i],
  ['data-analyst', 'Data analyst', /\b(data analy|business intelligence|bi analyst|bi developer|insights? analyst|analytics analyst|reporting analyst|data director|head of data)/i],
  ['devops-engineer', 'DevOps and SRE', /\b(devops|site reliability|sre\b|platform engineer|infrastructure engineer|cloud engineer|systems engineer|kubernetes|network (deployment )?engineer)/i],
  ['security', 'Cyber security', /\b(security|cyber|infosec|penetration|soc analyst|grc\b|protective services)/i],
  ['qa-engineer', 'QA and test', /\b(qa\b|quality assurance|quality analyst|test engineer|tester\b|sdet\b|test automation)/i],
  ['mobile-developer', 'Mobile developer', /\b(ios\b|android|mobile (engineer|developer)|react native|flutter)/i],
  ['frontend-developer', 'Front-end developer', /\b(front[- ]?end|frontend|ui engineer|web developer)/i],
  ['solutions', 'Solutions and pre-sales engineering', /\b(solutions? (engineer|architect|consultant)|pre-?sales|sales engineer|customer engineer|forward deployed|demo architect|partner engineer|field engineer|professional services)/i],
  ['software-engineer', 'Software engineer', /\b(software|developer|engineering (manager|director|lead)|director of engineering|head of engineering|vp,? engineering|backend|back[- ]end|full[- ]?stack|programmer|swe\b|golang|java\b|python|\.net\b|ruby|rust\b|c\+\+|staff engineer|principal engineer|tech lead|product engineer)/i],
  ['product-manager', 'Product manager', /\b(product manag|product owner|head of product|product lead|product director|director of product|vp,? product|group product)/i],
  ['product-designer', 'Product and UX designer', /\b(ux\b|ui\/ux|product design|user experience|interaction design|design (lead|manager|director)|user research)/i],
  ['designer', 'Designer', /\b(designer|creative|illustrat|art director|motion)/i],
  ['project-manager', 'Project and programme manager', /\b(project manag|programme manag|program manag|delivery (manager|lead)|scrum master|pmo\b|project coordinator|agile coach|technical program)/i],
  ['business-analyst', 'Business analyst', /\b(business analyst|systems analyst|process analyst)/i],
  ['marketing', 'Marketing', /\b(marketing|seo\b|ppc\b|growth|brand|content (manager|lead|strategist|marketing)|communications|pr manager|social media|copywriter|campaign|storytelling|advocacy)/i],
  ['sales', 'Sales', /\b(sales|account executive|business development|sdr\b|bdr\b|account manag|partnerships?\b|commercial manager|client partner|territory|deal desk|alliances?\b|channel partner|regional director|city manager)/i],
  ['customer-success', 'Customer success and support', /\b(customer success|customer support|customer service|support (engineer|specialist|agent|lead)|client services|customer experience|helpdesk|service desk|onboarding specialist|technical support|partner experience|contact centre|escalation|support engineering|mx support)/i],
  ['finance', 'Finance and accounting', /\b(finance|financial|accountant|accounting|accounts (receivable|payable)|fp&a|controller|payroll|treasury|tax\b|audit|bookkeep|credit|forecasting|debt|corporate development)/i],
  ['risk-compliance', 'Risk and compliance', /\b(risk|compliance|aml\b|kyc\b|fraud|financial crime|regulatory|controls)/i],
  ['legal', 'Legal', /\b(legal|lawyer|solicitor|counsel|paralegal|privacy|contracts? manager)/i],
  ['hr', 'HR and recruitment', /\b(hr\b|human resources|people (partner|operations|team|business|experience)|talent|recruit|compensation|reward|learning and development|l&d\b)/i],
  ['operations', 'Operations', /\b(operations|ops\b|logistics|supply chain|procurement|sourcing|facilities|office manager|workplace|strategy|asset management)/i],
  ['administration', 'Admin and assistants', /\b(administrat|admin\b|assistant|receptionist|coordinator)/i],
  ['research', 'Research and science', /\b(research|scientist|laborator|lab\b|clinical|biolog|chemist)/i],
  ['writing', 'Writing and content', /\b(writer|editor|technical writ|content)/i],
  ['education', 'Education and training', /\b(teacher|tutor|trainer|instructional|lecturer|education)/i],
  ['healthcare', 'Healthcare', /\b(nurse|doctor|clinician|pharmac|therapist|physio|medical|health)/i],
  ['engineering', 'Engineering (non-software)', /\b(mechanical|electrical|civil|hardware|manufacturing|process engineer|chemical engineer|structural|firmware|embedded)/i],
];

export function roleFamily(title = '') {
  for (const [slug, , re] of ROLE_FAMILIES) if (re.test(title)) return slug;
  return 'other';
}

export function seniority(title = '', srLevel = null) {
  const t = title.toLowerCase();
  if (/\b(intern|internship|placement|industrial placement|summer analyst)\b/.test(t)) return 'internship';
  if (/\b(graduate|grad\b|apprentice|trainee|entry[- ]level|junior|jr\.?|associate)\b/.test(t)) return 'entry';
  if (/\b(head of|director|vp\b|vice president|chief|cto|cfo|ceo|coo)\b/.test(t)) return 'director';
  if (/\b(lead|principal|staff|senior|sr\.?|manager)\b/.test(t)) return 'senior';
  if (srLevel === 'entry_level' || srLevel === 'internship') return srLevel === 'internship' ? 'internship' : 'entry';
  return 'mid';
}

// What the advert itself says about visa sponsorship. "no" wins over "yes" when both appear.
const SPONSOR_NO = [
  /\b(?:unable|not\s+able|can(?:no|')t|can\s+not|do(?:es)?\s+not|don't|doesn't|won't|will\s+not|are\s+not\s+able\s+to|aren't\s+able\s+to)\s+(?:to\s+)?(?:currently\s+)?(?:offer|provide|support|sponsor)\w*\s+(?:any\s+)?(?:visa|work\s+permit|sponsorship|immigration)/i,
  /\b(?:visa\s+)?sponsorship\s+(?:is\s+)?(?:not|unavailable|isn't)\s+(?:available|offered|provided|possible)/i,
  /\bno\s+(?:visa\s+)?sponsorship\b/i,
  // "work in the UK without sponsorship", not "without sponsorship for an export license"
  /\b(?:work|employment|employed|eligible|eligibility|right\s+to\s+work)\b[^.\n]{0,60}?\bwithout\s+(?:the\s+need\s+for\s+)?(?:(?:visa|immigration|employer)\s+)?sponsorship\b(?!\s+for\s+an?\s+export)/i,
  /\b(?:not|unable\s+to)\s+(?:be\s+)?(?:able\s+to\s+)?sponsor\b/i,
];
const SPONSOR_YES = [
  /\b(?:visa\s+)?sponsorship\s+(?:is\s+)?(?:available|offered|provided|possible|considered)\b/i,
  /\bwe\s+(?:can|will|are\s+able\s+to|are\s+happy\s+to|do|offer\s+to)\s+(?:offer\s+|provide\s+|consider\s+)?(?:visa\s+)?sponsor(?:ship)?\b/i,
  /\b(?:offer|provide|support)\w*\s+(?:visa\s+)?sponsorship\b/i,
  /\bskilled\s+worker\s+(?:visa\s+)?sponsorship\s+(?:is\s+)?available\b/i,
];

/** 'yes' | 'no' | null — what the advert itself says. */
export function advertSponsorship(text = '') {
  if (SPONSOR_NO.some(re => re.test(text))) return 'no';
  if (SPONSOR_YES.some(re => re.test(text))) return 'yes';
  return null;
}

// Agency and job-board signals (PRD B4): flagged for review, never auto-blocked (a real employer can say "client").
const AGENCY_NAME = /\b(recruitment|recruiting|staffing|resourcing|talent solutions|search partners|headhunt|jobs board|job board|careers network|placement)\b/i;
const AGENCY_TEXT = /\b(on behalf of (?:our|a) client|our client is|my client is|we are recruiting for|we're recruiting for|for one of our clients)\b/i;

export function agencySignal(employer = '', text = '') {
  if (AGENCY_NAME.test(employer)) return 'name';
  if (AGENCY_TEXT.test(text)) return 'advert';
  return null;
}
