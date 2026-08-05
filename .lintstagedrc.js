export default {
  '*.{ts,tsx}': ['npm run lint', 'npx tsc --noEmit', 'prettier --write'],
  '*.{js,json,md}': ['npm run lint', 'prettier --write'],
};
