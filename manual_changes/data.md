### Chemistry Courses Removed

From feedback: 
> In the extended chain view, there are a lot of chemistry courses that are students don't take and some that are listed are the headaches left over from Covid.  Our students need to take CHEM 121 (or 111) and CHEM 123 in year 1.  CHEM 233 and CHEM 235 in year 2 (or CHEM 203)

Courses Removed from `data/micb_courses_dependancies.json`:

- 100 Level Courses
    - CHEM 115
    - CHEM 135
    - CHEM 141
    - CHEM 154

- 200 Level Courses
    - CHEM 213
    - CHEM 223
    - CHEM 260

Note: Also removed as prerequisite from courses to prevent errors in script.

### Themes

- Added MICB 306 under 'Human Health' manually (In CSV and JSON, not in the extraction logic).
- Switched climate to Environmental Microbiology (only JSON)

### Others

- Added CHEM 203 as prerequisite to BIOL 200 (Not identified by code).
- Created fake subclusters (see code) to force certain nodes to be placed together (based on feedback).