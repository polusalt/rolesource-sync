# RoleSource sync

The daily job sync for RoleSource, a free job search that lists jobs from employers' own careers pages.

- Reads public job-board APIs only (Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee, Personio). It never scrapes LinkedIn, Indeed or HTML career pages.
- `data/employers.json`: the employer job boards that are read. `data/blocklist.json`: recruitment agencies, job boards and panels whose jobs are never listed.
- Runs once a day on GitHub Actions (`.github/workflows/sync.yml`). The job data is not stored in this repo.

Employers who want their jobs removed can ask through the contact page on the RoleSource site.
