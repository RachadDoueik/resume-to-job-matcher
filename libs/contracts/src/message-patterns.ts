// The "Contract" for message names
export const MSG = {
  SCRAPE_JOB: { cmd: 'scrape_job' },
  SCRAPE_AND_MATCH: { cmd: 'scrape_and_match' },
  MATCH_RESUME: { cmd: 'match_resume' },
  OPTIMIZE_RESUME: { cmd: 'optimize_resume' } // used for RabbitMQ
} as const;