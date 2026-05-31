# Contributing

## Development setup
1. Install Node.js 18+
2. Install Python 3 with venv support
3. Run:
   - npm install
   - npm run setup:local
   - npm run start:local

## Coding rules
- Keep changes small and focused
- Preserve local-first behavior
- Do not introduce forced cloud dependencies
- Validate by printing with local USB device when touching print logic

## Pull request checklist
- [ ] README updated (if behavior changed)
- [ ] Local API endpoint tested
- [ ] One real print test executed
- [ ] No secrets committed
